package com.workbench.backendjava.service;



import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import com.workbench.backendjava.common.PageResult;

import com.workbench.backendjava.entity.RagSourceSignal;

import com.workbench.backendjava.mapper.RagSourceSignalMapper;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;



import java.time.LocalDateTime;

import java.util.HashMap;

import java.util.List;

import java.util.Map;



/**

 * RAG 文档源（filename/source）级反馈信号（penalty/boost）持久化。

 * Python rerank（{@code reranker.py}）经 {@link com.workbench.backendjava.controller.RagInternalController}

 * 拉全量信号，按 {@code penalty * SOURCE_PENALTY_WEIGHT} / {@code boost * SOURCE_BOOST_WEIGHT} 调整排序分。

 * {@link #MAX_PENALTY}/{@link #MAX_BOOST} 为单 source 累计上/下调上限，防止整篇文档被过度压制或抬升。

 * 写入方：{@link RagFeedbackFixService}；Admin 可读/清零见 {@link com.workbench.backendjava.controller.AdminRagSignalController}。

 */

@Service

@RequiredArgsConstructor

public class RagSourceSignalService {



    /** 单 source penalty 累计上限，对应 Python rerank 最大扣分幅度。 */

    private static final int MAX_PENALTY = 5;

    /** 单 source boost 累计上限，对应 Python rerank 最大加分幅度。 */

    private static final int MAX_BOOST = 5;



    private final RagSourceSignalMapper signalMapper;



    /**

     * 加载全部 source 信号为 map（source → row）。

     * 调用方：{@link com.workbench.backendjava.controller.RagInternalController#sourceSignals}（Python 回调）。

     */

    public Map<String, RagSourceSignal> loadAllAsMap() {

        List<RagSourceSignal> rows = signalMapper.selectList(new LambdaQueryWrapper<>());

        Map<String, RagSourceSignal> map = new HashMap<>();

        for (RagSourceSignal row : rows) {

            if (row.getSource() != null && !row.getSource().isBlank()) {

                map.put(row.getSource(), row);

            }

        }

        return map;

    }



    /**

     * 分页列出 penalty 或 boost &gt; 0 的活跃信号（Admin 运维页）。

     * 调用方：{@link com.workbench.backendjava.controller.AdminRagSignalController#listSourceSignals}；

     * 前端 {@code listSourceSignalsApi}。

     */

    public PageResult<RagSourceSignal> listActiveSignalsPage(long page, long size) {

        long p = Math.max(page, 1);

        long s = Math.min(Math.max(size, 1), 100);

        Page<RagSourceSignal> result = signalMapper.selectPage(

                new Page<>(p, s),

                new LambdaQueryWrapper<RagSourceSignal>()

                        .and(w -> w.gt(RagSourceSignal::getPenalty, 0).or().gt(RagSourceSignal::getBoost, 0))

                        .orderByDesc(RagSourceSignal::getUpdatedAt)

        );

        return PageResult.of(result.getRecords(), result.getTotal(), p, s);

    }



    /**

     * 清零指定 source 的 penalty；若 boost 也为 0 则删除行。

     * 调用方：{@link com.workbench.backendjava.controller.AdminRagSignalController#clearSourceSignal}（field=penalty）。

     */

    @Transactional

    public void clearPenalty(String source) {

        if (source == null || source.isBlank()) return;

        RagSourceSignal row = signalMapper.selectById(source);

        if (row == null) return;

        row.setPenalty(0);

        row.setUpdatedAt(LocalDateTime.now());

        if (intOrZero(row.getBoost()) <= 0) {

            signalMapper.deleteById(source);

        } else {

            signalMapper.updateById(row);

        }

    }



    /**

     * 清零指定 source 的 boost；若 penalty 也为 0 则删除行。

     * 调用方：{@link com.workbench.backendjava.controller.AdminRagSignalController#clearSourceSignal}（field=boost）。

     */

    @Transactional

    public void clearBoost(String source) {

        if (source == null || source.isBlank()) return;

        RagSourceSignal row = signalMapper.selectById(source);

        if (row == null) return;

        row.setBoost(0);

        row.setUpdatedAt(LocalDateTime.now());

        if (intOrZero(row.getPenalty()) <= 0) {

            signalMapper.deleteById(source);

        } else {

            signalMapper.updateById(row);

        }

    }



    /**

     * 删除指定 source 的全部信号（penalty + boost）。

     * 调用方：{@link com.workbench.backendjava.controller.AdminRagSignalController#clearSourceSignal}（field=all）。

     */

    @Transactional

    public void clearAll(String source) {

        if (source == null || source.isBlank()) return;

        signalMapper.deleteById(source);

    }



    /** null-safe 整数转 int，null 视为 0。 */

    private static int intOrZero(Integer value) {

        return value != null ? value : 0;

    }



    /** 对指定 source 累加 penalty（封顶 {@link #MAX_PENALTY}），不存在则 insert。调用方：{@link RagFeedbackFixService}。 */

    @Transactional

    public void addSourcePenalty(String source, int delta) {

        if (source == null || source.isBlank()) return;

        RagSourceSignal row = signalMapper.selectById(source);

        if (row == null) {

            row = new RagSourceSignal();

            row.setSource(source);

            row.setPenalty(Math.min(MAX_PENALTY, Math.max(0, delta)));

            row.setBoost(0);

            row.setUpdatedAt(LocalDateTime.now());

            signalMapper.insert(row);

            return;

        }

        row.setPenalty(Math.min(MAX_PENALTY, Math.max(0, (row.getPenalty() != null ? row.getPenalty() : 0) + delta)));

        row.setUpdatedAt(LocalDateTime.now());

        signalMapper.updateById(row);

    }



    /** 对指定 source 累加 boost（封顶 {@link #MAX_BOOST}），不存在则 insert。调用方：{@link RagFeedbackFixService}。 */

    @Transactional

    public void addSourceBoost(String source, int delta) {

        if (source == null || source.isBlank()) return;

        RagSourceSignal row = signalMapper.selectById(source);

        if (row == null) {

            row = new RagSourceSignal();

            row.setSource(source);

            row.setPenalty(0);

            row.setBoost(Math.min(MAX_BOOST, Math.max(0, delta)));

            row.setUpdatedAt(LocalDateTime.now());

            signalMapper.insert(row);

            return;

        }

        row.setBoost(Math.min(MAX_BOOST, Math.max(0, (row.getBoost() != null ? row.getBoost() : 0) + delta)));

        row.setUpdatedAt(LocalDateTime.now());

        signalMapper.updateById(row);

    }

}


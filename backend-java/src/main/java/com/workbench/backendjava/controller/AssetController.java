 package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.PageResult;
import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.AssetImportUrlRequest;
import com.workbench.backendjava.dto.AssetTagsUpdateRequest;
import com.workbench.backendjava.dto.AssetUpdateRequest;
import com.workbench.backendjava.dto.IdsBatchDeleteRequest;
import com.workbench.backendjava.service.AssetService;
import com.workbench.backendjava.vo.AssetStatsVO;
import com.workbench.backendjava.vo.AssetUploadVO;
import com.workbench.backendjava.vo.AssetVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/assets")
@RequiredArgsConstructor
public class AssetController {

    private final AssetService assetService;

    /**
     * @RequestParam("file")这是?传参，从请求中取出名为file的参数。因为文件路径会显示在地址的filekey后面
     * 例如：
     * file:///E:/%E8%B5%84%E6%96%99/%E5%AE%9E%E4%B9%A0/%E7%AE%80%E5%8E%86/%E9%92%B1%E4%B8%80%E5%B8%86%E4%B8%AA%E4%BA%BA%E7%AE%80%E5%8E%86%20-%20A4.pdf
     * MultipartFile是SpringMVC提供的一个接口，用于处理文件上传。
     * 前端上传的时候，表单字段名必须是file，如果是uploadfile的话，那就要改成@RequestParam("uploadfile")
     * @param file
     * @return
     */
    @PostMapping("/upload")
    public Result<AssetUploadVO> upload(@RequestParam("file") MultipartFile file) {
        return Result.ok(assetService.upload(file));
    }

    /**
     * 分页查询当前用户的素材列表
     * @param page
     * @param size
     * @return
     */
    @GetMapping
    public Result<PageResult<AssetVO>> list(@RequestParam(defaultValue = "1") Long page,
                                            @RequestParam(defaultValue = "10") Long size,
                                            @RequestParam(required = false) Long tagId,
                                            @RequestParam(required = false) String keyword,
                                            @RequestParam(required = false) String type,
                                            @RequestParam(defaultValue = "desc") String sort,
                                            @RequestParam(defaultValue = "false") boolean includeTags
    ) {
        return Result.ok(assetService.listPage(page, size, tagId, keyword, type, sort, includeTags));
    }

    /**
     * 获取素材详情
     * @param id
     * @return
     */
    @PostMapping("/batch-delete")
    public Result<Void> batchDelete(@Valid @RequestBody IdsBatchDeleteRequest request) {
        assetService.deleteBatch(request);
        return Result.ok();
    }

    @GetMapping("/{id}")
    public Result<AssetVO> getDetail(@PathVariable Long id) {
        return Result.ok(assetService.getDetail(id));
    }

    /**
     * 删除素材
     */
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        assetService.delete(id);
        return Result.ok();
    }

    /**
     * 修改素材（目前仅支持改名）
     */
    @PatchMapping("/{id}")
    public Result<AssetVO> update(@PathVariable Long id,
                                  @Valid @RequestBody AssetUpdateRequest request) {
        return Result.ok(assetService.updateName(id, request));
    }
    /**
     * 整批替换素材标签
     */
    @PutMapping("/{id}/tags")
    public Result<Void> replaceTags(@PathVariable Long id,
                                    @RequestBody AssetTagsUpdateRequest request) {
        assetService.replaceTags(id, request);
        return Result.ok();
    }

    /**
     * 素材绑定标签
     */
    @PostMapping("/{assetId}/tags/{tagId}")
    public Result<Void> bindTag(@PathVariable Long assetId, @PathVariable Long tagId) {
        assetService.bindTag(assetId, tagId);
        return Result.ok();
    }

    @PostMapping("/import-url")
    public Result<AssetVO> importUrl(@Valid @RequestBody AssetImportUrlRequest request) {
        String name = request.getName() != null && !request.getName().isBlank()
                ? request.getName().trim() : "imported.png";
        List<String> tags = request.getTags() != null ? request.getTags() : List.of("generated");
        return Result.ok(assetService.importFromUrl(request.getUrl().trim(), name, tags));
    }

    /**
     * kpi卡片数据
     */
    @GetMapping("/stats")
    public Result<AssetStatsVO> stats() {
        return Result.ok(assetService.getStats());
    }
}

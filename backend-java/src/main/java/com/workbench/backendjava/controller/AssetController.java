package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.service.AssetService;
import com.workbench.backendjava.vo.AssetUploadVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

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
}

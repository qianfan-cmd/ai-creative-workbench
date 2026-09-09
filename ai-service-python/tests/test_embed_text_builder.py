"""入库 embedding 文本构建测试。"""
from app.services.embed_text_builder import build_embed_text


def test_build_embed_text_includes_filename():
    text = build_embed_text(
        filename="PNG文件上传报错修复过程.md",
        content="function fix() {}",
        heading="修复步骤",
        chunk_summary="PNG 上传修复函数",
    )
    assert "文档:PNG文件上传报错修复过程.md" in text
    assert "小节:修复步骤" in text
    assert "摘要:PNG 上传修复函数" in text
    assert "function fix() {}" in text


def test_build_embed_text_content_only_stored_separately():
    content = "纯正文"
    embed = build_embed_text(filename="a.md", content=content)
    assert embed.startswith("文档:a.md\n")
    assert content in embed
    assert embed != content

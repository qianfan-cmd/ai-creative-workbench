"""图像 Provider 抽象 — Phase 2 接 Seedream / 通义万相真实 HTTP。"""

from abc import ABC, abstractmethod # ABC 抽象基类，abstractmethod 抽象方法
from dataclasses import dataclass # dataclass 数据类，自动生成 __init__、__repr__、__eq__ 等方法，类似 Spring 的 @Data
from typing import List


@dataclass
class ImageCandidate:
    """一次生成结果中的单张候选图"""
    url: str
    index: int

# 抽象类，子类必须实现 name、is_configured、generate 方法
class ImageProvider(ABC):
    """抠图/生图共用接口；子类实现 name、is_configured、generate。"""

    @property # 属性装饰器，将方法转换为属性，可以直接通过实例.name 访问，而不是方法调用
    @abstractmethod # 抽象方法装饰器，子类必须实现
    def name(self) -> str:
        """提供商名称，例如 Seedream 或通义万相"""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """环境变量是否齐全，未配置时不应调外部 API"""
        pass

    @abstractmethod
    def generate(
        self,
        *,
        source_url: str | None,
        prompt: str,
        count: int = 4,
    ) -> List[ImageCandidate]:
        pass
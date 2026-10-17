from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class HardwareResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    category_id: str = Field(alias="categoryId")
    brand: str
    model: str
    name: str
    specifications: dict[str, str]


class OfferResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    hardware_id: str = Field(alias="hardwareId")
    platform: Literal["jd", "taobao"]
    product_id: str = Field(alias="productId")
    shop: str
    price: float
    currency: Literal["CNY"] = "CNY"
    price_type: Literal["listed"] = Field(default="listed", alias="priceType")
    product_url: str | None = Field(default=None, alias="productUrl")
    collected_at: str = Field(alias="collectedAt")
    source: Literal["api"] = "api"

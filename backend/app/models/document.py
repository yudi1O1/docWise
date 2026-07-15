from typing import Annotated, Literal

from pydantic import BaseModel, Field


class ElementSource(BaseModel):
    page_number: int = Field(alias="pageNumber", ge=1)
    original_text: str | None = Field(default=None, alias="originalText")
    original_x: float | None = Field(default=None, alias="originalX")
    original_y: float | None = Field(default=None, alias="originalY")
    original_width: float | None = Field(default=None, alias="originalWidth")
    original_height: float | None = Field(default=None, alias="originalHeight")
    is_new: bool = Field(default=False, alias="isNew")

    model_config = {"populate_by_name": True}


class TextElement(BaseModel):
    id: str
    type: Literal["text"] = "text"
    content: str
    x: float
    y: float
    width: float = Field(ge=0)
    height: float = Field(ge=0)
    font_size: float = Field(alias="fontSize", gt=0)
    font_family: str = Field(alias="fontFamily")
    font_weight: Literal["normal", "bold"] = Field(default="normal", alias="fontWeight")
    font_style: Literal["normal", "italic"] = Field(default="normal", alias="fontStyle")
    color: str
    alignment: Literal["left", "center", "right"] = "left"
    rotation: float = 0
    source: ElementSource

    model_config = {"populate_by_name": True}


DocumentElement = Annotated[TextElement, Field(discriminator="type")]


class PageModel(BaseModel):
    page_number: int = Field(alias="pageNumber", ge=1)
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    elements: list[DocumentElement]

    model_config = {"populate_by_name": True}


class DocumentModel(BaseModel):
    source_type: Literal["pdf"] = Field(alias="sourceType")
    file_name: str = Field(alias="fileName")
    page_count: int = Field(alias="pageCount", ge=1)
    pages: list[PageModel]

    model_config = {"populate_by_name": True}

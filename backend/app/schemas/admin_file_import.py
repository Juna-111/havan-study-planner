from pydantic import BaseModel
class UniversityImportPreview(BaseModel):
 rows:int;universities:int;curriculums:int;streams:int;course_mappings:int
class UniversityImportResult(BaseModel):
 universities:int;curriculums:int;streams:int;courses:int;mappings:int
class PromotionImportPreview(BaseModel): promotions:int
class PromotionImportResult(BaseModel): created:int;updated:int

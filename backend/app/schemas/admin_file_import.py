from pydantic import BaseModel
class UniversityImportPreview(BaseModel):
 rows:int;universities:int;curriculums:int;streams:int;course_mappings:int
class UniversityImportResult(BaseModel):
 universities:int;curriculums:int;streams:int;courses:int;mappings:int;archived_mappings:int=0;reactivated_mappings:int=0
class PromotionImportPreview(BaseModel): promotions:int
class PromotionImportResult(BaseModel): created:int;updated:int

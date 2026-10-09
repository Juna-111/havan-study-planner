from pydantic import BaseModel
class UniversityImportPreview(BaseModel):
 rows:int;universities:int;streams:int;course_mappings:int;course_offerings:int=0
class UniversityImportResult(BaseModel):
 universities:int;streams:int;courses:int;mappings:int;archived_mappings:int=0;reactivated_mappings:int=0
 offerings:int=0;archived_offerings:int=0;reactivated_offerings:int=0
class PromotionImportPreview(BaseModel): promotions:int
class PromotionImportResult(BaseModel): created:int;updated:int

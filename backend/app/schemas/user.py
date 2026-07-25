from pydantic import BaseModel

class UserCreate(Basemodel):
    name: str
    email: str
    role: str
    
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
import pandas as pd
from io import BytesIO, StringIO
from app.db.session import Base, engine


async def lifespan(app):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Excel to Invoice Service", lifespan=lifespan)


@app.get("/")
def read_root():
    return {"message": "Welcome to The Invoice Builder"}


@app.post("/upload")
async def parse_invoice_data(
    csv_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    if not csv_text and not file:
        raise HTTPException(
            status_code=400, detail="Provide either pasted CSV text or upload a file."
        )

    try:
        if csv_text:
            df = pd.read_csv(StringIO(csv_text))
        elif file and file.filename.endswith(".xlsx"):
            contents = await file.read()
            df = pd.read_excel(BytesIO(contents))
        else:
            raise HTTPException(
                status_code=400, detail="Only .xlsx files or CSV text supported."
            )
        
        print("RAW CSV TEXT:", repr(csv_text))
        parsed_data = df.to_dict(orient="records")
        return {"status": "success", "rows": parsed_data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse: {str(e)}")

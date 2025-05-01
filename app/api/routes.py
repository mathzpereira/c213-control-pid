from fastapi import APIRouter, UploadFile, File, HTTPException
from scipy.io import loadmat
import io

router = APIRouter()


@router.post("/import_dataset")
async def import_dataset(file: UploadFile = File(...)):
    """
    Endpoint to import a dataset file (.mat format).
    """
    if not file.filename.endswith(".mat"):
        raise HTTPException(status_code=400, detail="Apenas arquivos .mat são aceitos.")

    try:
        mat_data = loadmat(file.file)

        variables = {
            key: value for key, value in mat_data.items() if not key.startswith("__")
        }
        return {
            "message": "Dataset importado com sucesso.",
            "variables": list(variables.keys()),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro processando o arquivo: {str(e)}"
        )

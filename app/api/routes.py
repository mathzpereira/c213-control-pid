from fastapi import APIRouter, Query, UploadFile, File, HTTPException
from scipy.io import loadmat
from app.api.services import PidService

router = APIRouter()

service = PidService()


@router.post("/import_dataset")
async def import_dataset(file: UploadFile = File(...)):
    """
    Endpoint para importar um arquivo de dataset no formato .mat.
    """
    if not file.filename.endswith(".mat"):
        raise HTTPException(status_code=400, detail="Apenas arquivos .mat são aceitos.")

    try:
        mat_data = loadmat(file.file)
        load_result = service.load_dataset(mat_data)

        return {
            "mensagem": "Dataset importado e processado com sucesso.",
            "detalhes": load_result,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro ao processar o arquivo: {str(e)}"
        )


@router.post("/identify_model")
async def identify_model(method: str = Query(...)):
    """
    Endpoint para identificar os parâmetros k, tau e theta a partir do método escolhido.
    """
    try:
        k, tau, theta = service.identification_method(method=method)
        service._k, service._tau, service._theta = k, tau, theta
        return {
            "mensagem": "Modelo identificado com sucesso.",
            "k": k,
            "tau": tau,
            "theta": theta,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro na identificação: {str(e)}")


@router.get("/compare_response")
def compare_response():
    """
    Retorna a resposta real e a resposta simulada do modelo de primeira ordem.
    """
    try:
        real = service._temperature.tolist()
        simulated = service.simulate_model_response().tolist()
        time = service._time.tolist()

        return {
            "mensagem": "Comparação gerada com sucesso.",
            "tempo": time,
            "resposta_real": real,
            "resposta_modelo": simulated,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao comparar: {str(e)}")


@router.get("/tune_pid")
def tune_pid(
    method: str = Query(..., description="Método de sintonia: 'imc' ou 'itae'"),
):
    """
    Realiza a sintonia PID com base no método fornecido (IMC ou ITAE).
    """
    try:
        result = service.tune_pid(method)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro interno na sintonia: {str(e)}"
        )

from typing import Optional
from fastapi import APIRouter, Body, Query, UploadFile, File, HTTPException
from scipy.io import loadmat
import control as ctrl
import numpy as np
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


@router.get("/calculate_rmse")
def calculate_rmse():
    """
    Calcula o RMSE (Root Mean Square Error) para os métodos Smith e Sundaresan.

    Retorna:
    - RMSE Smith
    - RMSE Sundaresan
    - Melhor método (menor erro)
    """
    try:
        rmse_smith = service.calculate_rmse("smith")
        rmse_sundaresan = service.calculate_rmse("sundaresan")

        melhor = "smith" if rmse_smith < rmse_sundaresan else "sundaresan"

        return {
            "mensagem": "Cálculo de RMSE realizado com sucesso.",
            "rmse_smith": rmse_smith,
            "rmse_sundaresan": rmse_sundaresan,
            "melhor_modelo": melhor,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao calcular RMSE: {str(e)}")


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
    lambda_: Optional[float] = Query(
        None,
        alias="lambda",
        description="Parâmetro lambda para sintonia IMC (opcional)",
    ),
):
    """
    Realiza a sintonia PID com base no método fornecido (IMC ou ITAE).
    """
    try:
        result = service.tune_pid(method=method, lambda_=lambda_)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro interno na sintonia: {str(e)}"
        )


@router.get("/transfer_function")
def get_transfer_function():
    """
    Retorna os coeficientes da função de transferência com aproximação de Padé.
    """
    try:
        parameters = service.get_parameters()
        k = parameters["k"]
        tau = parameters["tau"]
        theta = parameters["theta"]

        num = [k]
        den = [tau, 1]
        G = ctrl.tf(num, den)

        if theta > 0:
            G_total = service.get_delayed_transfer_function()
        else:
            G_total = G

        return {
            "mensagem": "Função de transferência gerada com sucesso.",
            "numerador": list(G_total.num[0][0]),
            "denominador": list(G_total.den[0][0]),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro ao gerar função de transferência: {str(e)}"
        )


@router.get("/closed_loop")
def closed_loop_response(
):
    """
    Retorna a resposta da malha fechada.
    """
    try:
        open_loop = service.get_delayed_transfer_function()
        closed_loop = ctrl.feedback(open_loop)
        t_out, y_out = ctrl.step_response(closed_loop, T=service._time.astype(float))

        return {
            "mensagem": "Resposta da malha fechada gerada com sucesso.",
            "tempo": t_out.tolist(),
            "resposta": y_out.tolist(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro na resposta em malha fechada: {str(e)}"
        )


@router.get("/open_loop")
def open_loop_response(
):
    """
    Retorna a resposta em malha aberta do sistema.
    """
    try:
        open_loop = service.get_delayed_transfer_function()
        t_out, y_out = ctrl.step_response(open_loop, T=service._time.astype(float))

        return {
            "mensagem": "Resposta em malha aberta gerada com sucesso.",
            "tempo": t_out.tolist(),
            "resposta": y_out.tolist(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro na resposta em malha aberta: {str(e)}"
        )


@router.post("/custom_pid_simulation")
def custom_pid_simulation(
    kp: float = Body(..., embed=True),
    ti: float = Body(..., embed=True),
    td: float = Body(..., embed=True),
    setpoint: float = Body(..., embed=True),
):
    """
    Simula o comportamento do sistema com um controlador PID customizado.

    Retorna o tempo, a resposta do sistema controlado e valor do setpoint.
    """
    try:
        time = service._time.astype(float)
        plant = service.get_delayed_transfer_function()
        pid = ctrl.tf([kp * ti * td, kp * ti, kp], [ti, 0])
        closed_loop = ctrl.feedback(pid * plant)

        reference = np.ones_like(time) * setpoint

        t_out, y_out = ctrl.forced_response(closed_loop, T=time, U=reference)

        return {
            "mensagem": "Simulação com PID customizado realizada com sucesso.",
            "tempo": t_out.tolist(),
            "saida": y_out.tolist(),
            "referencia": reference.tolist(),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na simulação PID: {str(e)}")

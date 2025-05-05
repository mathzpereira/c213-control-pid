import numpy as np
from numpy import ndarray
import control as ctrl


class PidService:
    def __init__(self):
        self._dataset: dict | None = None
        self._step: ndarray | None = None
        self._time: ndarray | None = None
        self._temperature: ndarray | None = None
        self._k: float = 0
        self._tau: float = 0
        self._theta: float = 0

    def get_parameters(self):
        return {
            "k": self._k,
            "tau": self._tau,
            "theta": self._theta,
        }

    def get_dataset(self):
        return {
            "time": self._time,
            "input": self._step,
            "output": self._temperature,
        }

    def load_dataset(self, mat_data: dict):
        """
        Carrega e armazena os arrays relevantes do arquivo .mat importado.
        """
        try:
            experiment = mat_data["reactionExperiment"]
            data = experiment[0][0]

            self._time = data["sampleTime"].flatten()
            self._step = data["dataInput"].flatten()
            self._temperature = data["dataOutput"].flatten()

            return {
                "mensagem": "Dataset carregado com sucesso.",
                "tamanho_tempo": len(self._time),
                "tamanho_entrada": len(self._step),
                "tamanho_temperatura": len(self._temperature),
            }

        except Exception as e:
            raise ValueError(f"Erro ao analisar o dataset: {str(e)}")

    def identification_method(self, method: str):
        """
        Identifica e retorna k, tau e theta com base no método fornecido.
        """
        if self._time is None or self._temperature is None or self._step is None:
            raise ValueError("Os dados ainda não foram carregados.")

        time = self._time
        temperature = self._temperature
        step = self._step

        final_value = temperature[-1]
        k = final_value / np.mean(step)

        if method == "smith":
            t1 = time[np.where(temperature >= 0.283 * final_value)[0][0]]
            t2 = time[np.where(temperature >= 0.632 * final_value)[0][0]]
            tau = 1.5 * (t2 - t1)
            theta = t2 - tau
        elif method == "sundaresan":
            t1 = time[np.where(temperature >= 0.353 * final_value)[0][0]]
            t2 = time[np.where(temperature >= 0.853 * final_value)[0][0]]
            tau = (2 / 3) * (t2 - t1)
            theta = (1.3 * t1) - (0.29 * t2)
        else:
            raise ValueError("Método não suportado. Use 'smith' ou 'sundaresan'.")

        self._k = k
        self._tau = tau
        self._theta = theta

        return k, tau, theta

    def simulate_model_response(self):
        """
        Simula a resposta do modelo de primeira ordem usando os parâmetros identificados.
        Retorna um array com a resposta simulada ao longo do tempo.
        """
        if self._time is None or self._step is None or self._temperature is None:
            raise ValueError("Dataset ainda não carregado.")
        if self._k == 0 or self._tau == 0:
            raise ValueError("Modelo ainda não identificado.")

        t = self._time
        step_amplitude = np.mean(self._step)

        response = np.zeros_like(t)
        for i in range(len(t)):
            if t[i] >= self._theta:
                response[i] = (
                    self._k
                    * step_amplitude
                    * (1 - np.exp(-(t[i] - self._theta) / self._tau))
                )
            else:
                response[i] = 0

        return response

    def tune_pid(self, method: str) -> dict:
        """
        Realiza a sintonia PID com base no método especificado.

        Retorna os parâmetros PID ajustados (kp, ti, td) e uma mensagem de sucesso.

        """
        if self._k == 0 or self._tau == 0:
            raise ValueError(
                "Modelo não identificado. Use a identificação antes da sintonia."
            )

        k = self._k
        tau = self._tau
        theta = self._theta

        if method.lower() == "imc":
            lambda_ = tau

            kp = (2 * tau + theta) / (k * (2 * lambda_ + theta))
            ti = (theta / 2) + tau
            td = (tau * theta) / (2 * tau + theta)

        elif method.lower() == "itae":
            kp = (0.965 / k) * (tau / theta) ** (-0.85)
            ti = tau / (0.796 + (-0.147 * (theta / tau)))
            td = tau * 0.308 * (theta / tau) ** 0.929

        else:
            raise ValueError("Método não suportado. Use 'imc' ou 'itae'.")

        return {
            "mensagem": f"Sintonia PID realizada com sucesso pelo método {method.upper()}.",
            "kp": round(kp, 4),
            "ti": round(ti, 4),
            "td": round(td, 4),
        }

    def get_delayed_transfer_function(self):
        """
        Retorna a função de transferência com atraso (retardo) aproximado por Padé.
        """
        G = ctrl.tf([self._k], [self._tau, 1])

        num_pade, den_pade = ctrl.pade(self._theta, 1)
        delay = ctrl.tf(num_pade, den_pade)

        G_delay = G * delay

        return G_delay

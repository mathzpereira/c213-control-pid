import numpy as np
from numpy import ndarray


class PidService:
    def __init__(self):
        self._dataset: dict | None = None
        self._step: ndarray | None = None
        self._time: ndarray | None = None
        self._temperature: ndarray | None = None
        # self._tune_methods: dict[str, System] = {
        #     "CHR": CHR(self, 20),
        #     "Cohen and Coon": CohenCoon(self, 20),
        #     "IMC": IMC(self, 20),
        #     "ITAE": ITAE(self, 20),
        #     "Ziegler and Nichols": ZieglerNichols(self, 20),
        #     "Manual": Manual(self, 20),
        # }
        self._k: float = 0
        self._tau: float = 0
        self._theta: float = 0

    def load_dataset(self, mat_data: dict):
        """
        Carrega e armazena os arrays relevantes do arquivo .mat importado.
        """
        try:
            experiment = mat_data["reactionExperiment"]
            data = experiment[0][0]  # extrai o primeiro registro do experimento

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

    def identification_method(
        self, method: str, time: ndarray, temperature: ndarray, step: ndarray
    ):
        """
        Identifica e retorna k, tau e theta com base no método fornecido.

        Parâmetros:
            method (str): O método de identificação, pode ser "smith" ou "sundaresan".

        Retorna:
            tuple: Uma tupla contendo k, tau e theta.

        Lança:
            ValueError: Se o método não for reconhecido.
        """
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

        return k, tau, theta

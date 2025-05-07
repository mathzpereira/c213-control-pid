import {useState, useEffect} from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

const apiUrl = import.meta.env.VITE_API_URL

export default function PIDControlSystem() {
  const [file, setFile] = useState(null)
  const [fileUploaded, setFileUploaded] = useState(false)
  const [identificationMethod, setIdentificationMethod] = useState("smith")
  const [tuningMethod, setTuningMethod] = useState("imc")
  const [modelParameters, setModelParameters] = useState({
    k: 0,
    tau: 0,
    theta: 0,
  })
  const [pidParameters, setPidParameters] = useState({kp: 0, ti: 0, td: 0})
  const [customPid, setCustomPid] = useState({
    kp: 1,
    ti: 1,
    td: 0.1,
    setpoint: 1,
    pade_order: 20,
  })
  const [rmseData, setRmseData] = useState({
    rmse_smith: 0,
    rmse_sundaresan: 0,
    melhor_modelo: "-",
  })
  const [lambda, setLambda] = useState()
  const [error, setError] = useState(null)

  // States para os dados das respostas
  const [compareData, setCompareData] = useState([])
  const [openLoopData, setOpenLoopData] = useState([])
  const [closedLoopData, setClosedLoopData] = useState([])
  const [customPidData, setCustomPidData] = useState([])

  // State para carregar os botões
  const [loading, setLoading] = useState({
    upload: false,
    identify: false,
    tunePid: false,
    compare: false,
    openLoop: false,
    closedLoop: false,
    customPid: false,
  })

  // State para aba ativa (1: Comparar Resposta, 2: Malha Aberta, 3: Malha Fechada, 4: PID Customizado)
  const [activeTab, setActiveTab] = useState(1)

  // Alterar arquivo
  const handleFileChange = (e) => {
    setFile(e.target.files[0])
  }

  // Upload do dataset
  const handleUpload = async () => {
    if (!file) return
    setLoading({...loading, upload: true})

    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch(`${apiUrl}/import_dataset`, {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setFileUploaded(true)
        console.log("Dataset imported:", data)
        fetchRMSE()
      } else {
        console.error("Upload failed:", data.detail)
        alert(`Upload failed: ${data.detail}`)
      }
    } catch (error) {
      console.error("Error uploading file:", error)
      alert("Error uploading file. Please check your connection and try again.")
    } finally {
      setLoading({...loading, upload: false})
    }
  }

  // Erro Quadrático Médio (EQM)
  const fetchRMSE = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${apiUrl}/calculate_rmse`)
      const data = await response.json()

      if (response.ok) {
        setRmseData(data)
      } else {
        setError(data.detail || "Erro ao calcular RMSE")
      }
    } catch (error) {
      setError("Erro de conexão ao calcular RMSE")
      console.error("Error fetching RMSE data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Identificação do modelo
  const handleIdentifyModel = async () => {
    setLoading({...loading, identify: true})

    try {
      const response = await fetch(
        `${apiUrl}/identify_model?method=${identificationMethod}`,
        {
          method: "POST",
        },
      )

      const data = await response.json()

      if (response.ok) {
        setModelParameters({
          k: data.k,
          tau: data.tau,
          theta: data.theta,
        })
        handleCompareResponse()
        handleOpenLoopResponse()
        handleClosedLoopResponse()
      } else {
        console.error("Identification failed:", data.detail)
        alert(`Identification failed: ${data.detail}`)
      }
    } catch (error) {
      console.error("Error identifying model:", error)
      alert(
        "Error identifying model. Please check your connection and try again.",
      )
    } finally {
      setLoading({...loading, identify: false})
    }
  }

  // Comparar resposta
  const handleCompareResponse = async () => {
    setLoading({...loading, compare: true})

    try {
      const response = await fetch(`${apiUrl}/compare_response`)
      const data = await response.json()

      if (response.ok) {
        // Format data for chart
        const formattedData = data.tempo.map((time, index) => ({
          time: time,
          real: data.resposta_real[index],
          model: data.resposta_modelo[index],
        }))

        setCompareData(formattedData)
      } else {
        console.error("Comparison failed:", data.detail)
        alert(`Comparison failed: ${data.detail}`)
      }
    } catch (error) {
      console.error("Error fetching comparison:", error)
      alert(
        "Error fetching comparison. Please check your connection and try again.",
      )
    } finally {
      setLoading({...loading, compare: false})
    }
  }

  // Sintonia PID
  const handleTunePid = async () => {
    setLoading({...loading, tunePid: true})

    try {
      let url = `${apiUrl}/tune_pid?method=${tuningMethod}`
      if (tuningMethod === "imc" && lambda !== undefined) {
        url += `&lambda=${lambda}`
      }
      const response = await fetch(url)
      const data = await response.json()

      if (response.ok) {
        setPidParameters({
          kp: data.kp,
          ti: data.ti,
          td: data.td,
        })

        setCustomPid((prev) => ({
          ...prev,
          kp: data.kp,
          ti: data.ti,
          td: data.td,
          setpoint: data.setpoint,
        }))

        handleOpenLoopResponse()
        handleClosedLoopResponse()
      } else {
        console.error("PID tuning failed:", data.detail)
        alert(`PID tuning failed: ${data.detail}`)
      }
    } catch (error) {
      console.error("Error tuning PID:", error)
      alert("Error tuning PID. Please check your connection and try again.")
    } finally {
      setLoading({...loading, tunePid: false})
    }
  }

  const handleLambdaChange = (e) => {
    setLambda(parseFloat(e.target.value))
  }

  // Malha aberta
  const handleOpenLoopResponse = async () => {
    setLoading({...loading, openLoop: true})

    try {
      const response = await fetch(`${apiUrl}/open_loop`)
      const data = await response.json()

      if (response.ok) {
        const formattedData = data.tempo.map((time, index) => ({
          time: time,
          response: data.resposta[index],
        }))

        setOpenLoopData(formattedData)
      } else {
        console.error("Open loop fetch failed:", data.detail)
        alert(`Open loop fetch failed: ${data.detail}`)
      }
    } catch (error) {
      console.error("Error fetching open loop response:", error)
      alert(
        "Error fetching open loop response. Please check your connection and try again.",
      )
    } finally {
      setLoading({...loading, openLoop: false})
    }
  }

  // Malha fechada
  const handleClosedLoopResponse = async () => {
    setLoading({...loading, closedLoop: true})

    try {
      const response = await fetch(`${apiUrl}/closed_loop`)
      const data = await response.json()

      if (response.ok) {
        const formattedData = data.tempo.map((time, index) => ({
          time: time,
          response: data.resposta[index],
        }))

        setClosedLoopData(formattedData)
      } else {
        console.error("Closed loop fetch failed:", data.detail)
        alert(`Closed loop fetch failed: ${data.detail}`)
      }
    } catch (error) {
      console.error("Error fetching closed loop response:", error)
      alert(
        "Error fetching closed loop response. Please check your connection and try again.",
      )
    } finally {
      setLoading({...loading, closedLoop: false})
    }
  }

  // Sintonia PID
  const handleCustomPidSimulation = async () => {
    setLoading({...loading, customPid: true})

    try {
      const response = await fetch(`${apiUrl}/custom_pid_simulation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kp: customPid.kp,
          ti: customPid.ti,
          td: customPid.td,
          setpoint: customPid.setpoint,
          pade_order: customPid.pade_order,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        const formattedData = data.tempo.map((time, index) => ({
          time: time,
          output: data.saida[index],
          setpoint: data.referencia[index],
        }))

        setCustomPidData(formattedData)
        setActiveTab(4)
      } else {
        console.error("Custom PID simulation failed:", data.detail)
        alert(`Custom PID simulation failed: ${data.detail}`)
      }
    } catch (error) {
      console.error("Error in custom PID simulation:", error)
      alert(
        "Error in custom PID simulation. Please check your connection and try again.",
      )
    } finally {
      setLoading({...loading, customPid: false})
    }
  }

  // Customização PID
  const handleCustomPidChange = (e) => {
    const {name, value} = e.target
    setCustomPid({
      ...customPid,
      [name]: parseFloat(value),
    })
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <h1 className="text-2xl font-bold">Sistema de Controle PID</h1>
      </header>

      <div className="flex flex-grow overflow-hidden">
        {/* Sidebar da esquerda */}
        <div className="w-80 bg-white p-4 shadow-md overflow-auto">
          <div className="mb-4">
            <h2 className="font-semibold text-lg mb-2">Dataset</h2>
            <input
              type="file"
              accept=".mat"
              onChange={handleFileChange}
              className="block w-full text-sm text-black mb-2 cursor-pointer py-2 px-3 border rounded"
            />
            <button
              onClick={handleUpload}
              disabled={loading.upload}
              className="w-full bg-blue-500 text-white py-1 px-3 rounded disabled:bg-blue-300"
            >
              {loading.upload ? "Carregando..." : "Importar Dataset"}
            </button>
          </div>

          <div className="mb-4">
            <h2 className="font-semibold text-lg mb-2">
              Erro Quadrático Médio (EQM)
            </h2>
            <div className="grid grid-cols-3 gap-1">
              <div className="text-center">
                <p className="text-sm">Smith</p>
                <p className="font-mono">{rmseData.rmse_smith.toFixed(4)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm">Sundaresan</p>
                <p className="font-mono">
                  {rmseData.rmse_sundaresan.toFixed(4)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm">Melhor</p>
                <p className="font-mono">{rmseData.melhor_modelo}</p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h2 className="font-semibold text-lg mb-2">
              Identificação do Modelo
            </h2>
            <select
              value={identificationMethod}
              onChange={(e) => setIdentificationMethod(e.target.value)}
              disabled={!fileUploaded}
              className="w-full p-2 border rounded mb-2"
            >
              <option value="smith">Smith</option>
              <option value="sundaresan">Sundaresan</option>
            </select>
            <button
              onClick={handleIdentifyModel}
              disabled={!fileUploaded || loading.identify}
              className="w-full bg-green-500 text-white py-1 px-3 rounded disabled:bg-green-300"
            >
              {loading.identify ? "Identificando..." : "Identificar Modelo"}
            </button>
          </div>

          <div className="mb-4">
            <h2 className="font-semibold text-lg mb-2">Parâmetros do Modelo</h2>
            <div className="grid grid-cols-3 gap-1">
              <div className="text-center">
                <p className="text-sm">K</p>
                <p className="font-mono">{modelParameters.k.toFixed(4)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm">τ</p>
                <p className="font-mono">{modelParameters.tau.toFixed(4)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm">θ</p>
                <p className="font-mono">{modelParameters.theta.toFixed(4)}</p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h2 className="font-semibold text-lg mb-2">Sintonia PID</h2>
            <select
              value={tuningMethod}
              onChange={(e) => setTuningMethod(e.target.value)}
              disabled={modelParameters.k === 0}
              className="w-full p-2 border rounded mb-2"
            >
              <option value="imc">IMC</option>
              <option value="itae">ITAE</option>
            </select>

            {/* Campo de lambda que aparece apenas quando IMC está selecionado */}
            {tuningMethod === "imc" && (
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Lambda (λ)
                </label>
                <input
                  type="number"
                  value={lambda}
                  onChange={handleLambdaChange}
                  min="0.1"
                  step="0.1"
                  className="w-full p-2 border rounded mb-2"
                  placeholder="Valor de lambda"
                />
              </div>
            )}

            <button
              onClick={handleTunePid}
              disabled={modelParameters.k === 0 || loading.tunePid}
              className="w-full bg-purple-500 text-white py-1 px-3 rounded disabled:bg-purple-300"
            >
              {loading.tunePid ? "Sintonizando..." : "Sintonizar PID"}
            </button>
          </div>

          <div className="mb-4">
            <h2 className="font-semibold text-lg mb-2">Parâmetros do PID</h2>
            <div className="grid grid-cols-3 gap-1">
              <div className="text-center">
                <p className="text-sm">Kp</p>
                <p className="font-mono">{pidParameters.kp.toFixed(4)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm">Ti</p>
                <p className="font-mono">{pidParameters.ti.toFixed(4)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm">Td</p>
                <p className="font-mono">{pidParameters.td.toFixed(4)}</p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h2 className="font-semibold text-lg mb-2">PID Customizado</h2>
            <div className="mb-2">
              <label className="block text-sm">Kp</label>
              <input
                type="number"
                name="kp"
                value={customPid.kp}
                onChange={handleCustomPidChange}
                className="w-full p-1 border rounded"
                step="0.01"
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm">Ti</label>
              <input
                type="number"
                name="ti"
                value={customPid.ti}
                onChange={handleCustomPidChange}
                className="w-full p-1 border rounded"
                step="0.01"
                min="0.01"
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm">Td</label>
              <input
                type="number"
                name="td"
                value={customPid.td}
                onChange={handleCustomPidChange}
                className="w-full p-1 border rounded"
                step="0.01"
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm">Setpoint</label>
              <input
                type="number"
                name="setpoint"
                value={customPid.setpoint}
                onChange={handleCustomPidChange}
                className="w-full p-1 border rounded"
                step="0.1"
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm">Ordem de Pade</label>
              <input
                type="number"
                name="pade_order"
                value={customPid.pade_order}
                onChange={handleCustomPidChange}
                className="w-full p-1 border rounded"
                step="1"
              />
            </div>
            <button
              onClick={handleCustomPidSimulation}
              disabled={modelParameters.k === 0 || loading.customPid}
              className="w-full bg-orange-500 text-white py-1 px-3 rounded disabled:bg-orange-300"
            >
              {loading.customPid ? "Simulando..." : "Simular PID"}
            </button>
          </div>
        </div>

        {/* Área principal dos gráficos */}
        <div className="flex-1 p-4 overflow-auto">
          {/* Barra de navegação */}
          <div className="flex mb-4 border-b">
            <button
              className={`px-4 py-2 ${
                activeTab === 1
                  ? "border-b-2 border-blue-500 text-blue-500"
                  : "text-gray-500"
              }`}
              onClick={() => setActiveTab(1)}
            >
              Comparar Resposta
            </button>
            <button
              className={`px-4 py-2 ${
                activeTab === 2
                  ? "border-b-2 border-blue-500 text-blue-500"
                  : "text-gray-500"
              }`}
              onClick={() => setActiveTab(2)}
              disabled={openLoopData.length === 0}
            >
              Malha Aberta
            </button>
            <button
              className={`px-4 py-2 ${
                activeTab === 3
                  ? "border-b-2 border-blue-500 text-blue-500"
                  : "text-gray-500"
              }`}
              onClick={() => setActiveTab(3)}
              disabled={closedLoopData.length === 0}
            >
              Malha Fechada
            </button>
            <button
              className={`px-4 py-2 ${
                activeTab === 4
                  ? "border-b-2 border-blue-500 text-blue-500"
                  : "text-gray-500"
              }`}
              onClick={() => setActiveTab(4)}
              disabled={customPidData.length === 0}
            >
              PID Customizado
            </button>
          </div>

          {/* Exibição dos gráficos */}
          <div className="bg-white p-4 rounded shadow-md h-full">
            {/* Comparar resposta */}
            {activeTab === 1 && (
              <div className="h-full">
                <h2 className="text-xl font-semibold mb-4">
                  Comparação de Resposta: Real vs Modelo
                </h2>
                {compareData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="80%">
                    <LineChart data={compareData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="time"
                        label={{
                          value: "Tempo (s)",
                          position: "insideBottomRight",
                          offset: 0,
                        }}
                      />
                      <YAxis
                        label={{
                          value: "Temperatura",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="real"
                        name="Resposta Real"
                        stroke="#8884d8"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="model"
                        name="Modelo Simulado"
                        stroke="#82ca9d"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    {loading.compare
                      ? "Carregando dados..."
                      : "Identifique o modelo para visualizar a comparação"}
                  </div>
                )}
              </div>
            )}

            {/* Malha aberta */}
            {activeTab === 2 && (
              <div className="h-full">
                <h2 className="text-xl font-semibold mb-4">
                  Resposta em Malha Aberta
                </h2>
                {openLoopData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="80%">
                    <LineChart data={openLoopData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="time"
                        label={{
                          value: "Tempo (s)",
                          position: "insideBottomRight",
                          offset: 0,
                        }}
                      />
                      <YAxis
                        label={{
                          value: "Amplitude",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="response"
                        name="Malha Aberta"
                        stroke="#ff7300"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    {loading.openLoop
                      ? "Carregando dados..."
                      : "Sintonize o PID para visualizar a resposta em malha aberta"}
                  </div>
                )}
              </div>
            )}

            {/* Malha fechada */}
            {activeTab === 3 && (
              <div className="h-full">
                <h2 className="text-xl font-semibold mb-4">
                  Resposta em Malha Fechada
                </h2>
                {closedLoopData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="80%">
                    <LineChart data={closedLoopData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="time"
                        label={{
                          value: "Tempo (s)",
                          position: "insideBottomRight",
                          offset: 0,
                        }}
                      />
                      <YAxis
                        label={{
                          value: "Amplitude",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="response"
                        name="Malha Fechada"
                        stroke="#2196F3"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    {loading.closedLoop
                      ? "Carregando dados..."
                      : "Sintonize o PID para visualizar a resposta em malha fechada"}
                  </div>
                )}
              </div>
            )}

            {/* PID Customizado */}
            {activeTab === 4 && (
              <div className="h-full">
                <h2 className="text-xl font-semibold mb-4">
                  Simulação PID Customizado
                </h2>
                {customPidData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="80%">
                    <LineChart data={customPidData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="time"
                        label={{
                          value: "Tempo (s)",
                          position: "insideBottomRight",
                          offset: 0,
                        }}
                      />
                      <YAxis
                        label={{
                          value: "Amplitude",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="setpoint"
                        name="Setpoint"
                        stroke="#FF5722"
                        dot={false}
                        strokeDasharray="5 5"
                      />
                      <Line
                        type="monotone"
                        dataKey="output"
                        name="Saída"
                        stroke="#4CAF50"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    {loading.customPid
                      ? "Carregando dados..."
                      : "Configure e simule para visualizar a resposta do PID customizado"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="bg-gray-200 text-center p-2 text-sm text-gray-600">
        Sistema de Controle PID - C213 Sistemas Embarcados - ©{" "}
        <a
          href="https://github.com/mathzpereira"
          className="text-gray-600 hover:underline"
        >
          Matheus Pereira
        </a>
      </footer>
    </div>
  )
}

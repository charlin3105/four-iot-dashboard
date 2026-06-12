import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import mqtt from "mqtt";
import {
  Power,
  PowerOff,
  AlertTriangle,
  Thermometer,
  Clock,
  Cpu,
  RefreshCw,
  Download,
  Wifi,
  Cloud,
  Flame,
  Snowflake,
  Target,
  BarChart3,
  SlidersHorizontal,
  ListChecks,
  History,
  LayoutDashboard,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const now = () => new Date().toLocaleTimeString("fr-FR");

export default function App() {
  const [temperature, setTemperature] = useState(22);
  const [tempSeuil, setTempSeuil] = useState(35);
  const [tempRegulation, setTempRegulation] = useState(28);
  const [margeRegulation, setMargeRegulation] = useState(1);

  const [fourOn, setFourOn] = useState(false);
  const [chauffageActif, setChauffageActif] = useState(false);
  const [ledChauffage, setLedChauffage] = useState(false);
  const [refroidisseurOn, setRefroidisseurOn] = useState(false);
  const [urgence, setUrgence] = useState(false);
  const [surchauffe, setSurchauffe] = useState(false);
  const [regulationAtteinte, setRegulationAtteinte] = useState(false);
  const [systemOk, setSystemOk] = useState(true);
  const [simulation, setSimulation] = useState(false);
  const [cycles, setCycles] = useState(0);

  const [timerActif, setTimerActif] = useState(false);
  const [timerTotal, setTimerTotal] = useState(0);
  const [timerRestant, setTimerRestant] = useState(0);
  const [dureeChoisie, setDureeChoisie] = useState(60);

  const [espIp, setEspIp] = useState(localStorage.getItem("esp_ip") || "192.168.137.197");
  const [modeConnexion, setModeConnexion] = useState(localStorage.getItem("mode_connexion") || "LOCAL");
  const [mqttClient, setMqttClient] = useState(null);
  const [statusReseau, setStatusReseau] = useState("Déconnecté");

  const [graphData, setGraphData] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [popup, setPopup] = useState(null);

  const popupTimeoutRef = useRef(null);

  const dashboardRef = useRef(null);
  const analyseRef = useRef(null);
  const pilotageRef = useRef(null);
  const etatRef = useRef(null);
  const historiqueRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("esp_ip", espIp);
    localStorage.setItem("mode_connexion", modeConnexion);
  }, [espIp, modeConnexion]);

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const ajouterPopup = (message, type = "blue") => {
    setPopup({ message, type });
    clearTimeout(popupTimeoutRef.current);
    popupTimeoutRef.current = setTimeout(() => setPopup(null), 3500);
  };

  const ajouterHistorique = (action, cible = "ESP32") => {
    const log = {
      id: Date.now() + Math.random(),
      temps: now(),
      action,
      cible,
      mode: modeConnexion,
    };

    setHistorique((prev) => [log, ...prev.slice(0, 99)]);
  };

  const formatTemps = (secondes) => {
    const s = Math.max(0, Number(secondes || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;

    if (h > 0) return `${h}h ${m}min ${sec}s`;
    if (m > 0) return `${m}min ${sec}s`;
    return `${sec}s`;
  };

  const traiterDonneesESP32 = (data) => {
    const temp = Number(data.temperature ?? 0);
    const seuil = Number(data.tempSeuil ?? data.targetTemp ?? 35);
    const regulation = Number(data.tempRegulation ?? data.tempMaintien ?? 28);

    setTemperature(temp);
    setTempSeuil(seuil);
    setTempRegulation(regulation);
    setMargeRegulation(Number(data.margeRegulation ?? 1));

    setFourOn(Boolean(data.fourOn));
    setChauffageActif(Boolean(data.chauffageActif));
    setLedChauffage(Boolean(data.ledChauffage ?? data.fourOn));
    setRefroidisseurOn(Boolean(data.refroidisseurOn));
    setUrgence(Boolean(data.urgence));
    setSurchauffe(Boolean(data.surchauffe));
    setRegulationAtteinte(Boolean(data.regulationAtteinte));
    setSystemOk(Boolean(data.systemOk));
    setSimulation(Boolean(data.simulation));
    setCycles(Number(data.cycles ?? 0));

    setTimerActif(Boolean(data.timerActif));
    setTimerTotal(Number(data.timerTotal ?? 0));
    setTimerRestant(Number(data.timerRestant ?? 0));

    setStatusReseau(modeConnexion === "LOCAL" ? "Local connecté HTTP" : "Cloud connecté MQTT");

    setGraphData((prev) => [
      ...prev.slice(-25),
      {
        temps: now(),
        Temp: Number(temp.toFixed(2)),
        Regulation: regulation,
        Seuil: seuil,
      },
    ]);
  };

  useEffect(() => {
    if (modeConnexion !== "CLOUD") return;

    if (mqttClient) {
      mqttClient.end(true);
      setMqttClient(null);
    }

    setStatusReseau("Connexion cloud...");

    const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt", {
      reconnectPeriod: 3000,
      connectTimeout: 8000,
    });

    client.on("connect", () => {
      setStatusReseau("Cloud connecté MQTT");
      client.subscribe("atelier/four/etat");
      ajouterHistorique("Connexion au broker MQTT", "Cloud");
      ajouterPopup("Connexion Cloud MQTT réussie", "blue");
    });

    client.on("message", (topic, message) => {
      if (topic === "atelier/four/etat") {
        try {
          traiterDonneesESP32(JSON.parse(message.toString()));
        } catch {
          ajouterPopup("Message MQTT non valide", "red");
        }
      }
    });

    client.on("offline", () => setStatusReseau("Cloud hors ligne"));
    client.on("error", () => setStatusReseau("Erreur cloud"));

    setMqttClient(client);

    return () => client.end(true);
  }, [modeConnexion]);

  useEffect(() => {
    if (modeConnexion !== "LOCAL") return;

    if (mqttClient) {
      mqttClient.end(true);
      setMqttClient(null);
    }

    setStatusReseau("Mode local actif");

    const interval = setInterval(() => {
      fetch(`http://${espIp}/`, {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      })
        .then((res) => res.json())
        .then((data) => traiterDonneesESP32(data))
        .catch(() => setStatusReseau("Local déconnecté"));
    }, 1000);

    return () => clearInterval(interval);
  }, [modeConnexion, espIp]);

  const envoyerCommande = (routeLocal, commandeMqtt, description) => {
    ajouterHistorique(description);

    if (modeConnexion === "CLOUD") {
      if (mqttClient && mqttClient.connected) {
        mqttClient.publish("atelier/four/commandes", commandeMqtt);
      } else {
        ajouterPopup("MQTT non connecté", "red");
      }
    } else {
      fetch(`http://${espIp}${routeLocal}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      })
        .then((res) => res.json())
        .then((data) => traiterDonneesESP32(data))
        .catch(() => ajouterPopup("Commande HTTP non envoyée", "red"));
    }
  };

  const changerRegulation = (valeur) => {
    const nouvelleTemp = tempRegulation + valeur;
    setTempRegulation(nouvelleTemp);

    envoyerCommande(
      `/set/regulation?val=${nouvelleTemp}`,
      `SET_REGULATION:${nouvelleTemp}`,
      `Température de régulation réglée à ${nouvelleTemp}°C`
    );
  };

  const changerSeuil = (valeur) => {
    const nouveauSeuil = tempSeuil + valeur;
    setTempSeuil(nouveauSeuil);

    envoyerCommande(
      `/set/seuil?val=${nouveauSeuil}`,
      `SET_SEUIL:${nouveauSeuil}`,
      `Seuil critique réglé à ${nouveauSeuil}°C`
    );
  };

  const appliquerTimer = () => {
    if (!fourOn) {
      ajouterPopup("Allume d’abord le four pour choisir une durée", "red");
      return;
    }

    const secondes = Math.max(1, Math.min(3600, Number(dureeChoisie)));

    envoyerCommande(
      `/set/timer?val=${secondes}`,
      `SET_TIMER:${secondes}`,
      `Minuterie réglée à ${formatTemps(secondes)}`
    );
  };

  const basculerSimulation = () => {
    envoyerCommande(
      simulation ? "/sim/off" : "/sim/on",
      simulation ? "SIM_OFF" : "SIM_ON",
      simulation ? "Mode capteur physique activé" : "Mode simulation activé"
    );
  };

  const exporterCSV = () => {
    let contenu = "ID;Heure;Action;Cible;Mode\n";

    historique.forEach((log) => {
      contenu += `${log.id};${log.temps};${log.action};${log.cible};${log.mode}\n`;
    });

    const blob = new Blob([contenu], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");

    lien.href = url;
    lien.download = `historique_supervision_${Date.now()}.csv`;
    lien.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      {popup && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            background: popup.type === "red" ? "#7f1d1d" : "#0b3d70",
            color: "white",
            padding: "16px 20px",
            borderRadius: 14,
            fontWeight: 700,
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            maxWidth: 360,
          }}
        >
          🔔 {popup.message}
        </div>
      )}

      <div className="sidebar">
        <div className="logo">
          <div className="logo-icon">🎛️</div>
          <div>
            <h2>THERMO-CONTROL</h2>
            <p>SUPERVISION SCADA</p>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          <button onClick={() => scrollToSection(dashboardRef)}>
            <LayoutDashboard size={16} /> Tableau de bord
          </button>
          <button onClick={() => scrollToSection(analyseRef)}>
            <BarChart3 size={16} /> Analyse thermique
          </button>
          <button onClick={() => scrollToSection(pilotageRef)}>
            <SlidersHorizontal size={16} /> Pilotage du système
          </button>
          <button onClick={() => scrollToSection(etatRef)}>
            <ListChecks size={16} /> État des composants
          </button>
          <button onClick={() => scrollToSection(historiqueRef)}>
            <History size={16} /> Journal de traçabilité
          </button>
        </nav>

        <div className="system-box">
          <Cpu size={24} className={statusReseau.includes("connecté") ? "green-text" : "red-text"} />
          <div>
            <p style={{ fontSize: "13px" }}>ESP32 STATUS</p>
            <small>{statusReseau}</small>
          </div>
        </div>
      </div>

      <div className="main">
        <div ref={dashboardRef} className="header">
          <div>
            <h1>TABLEAU DE BORD SUPERVISEUR</h1>
            <p>Four thermique avec régulation impulsionnelle, sécurité seuil et contrôle local/cloud.</p>
          </div>

          <div className="header-actions">
            <button className={`badge ${modeConnexion === "LOCAL" ? "green" : "dark"}`} onClick={() => setModeConnexion("LOCAL")}>
              <Wifi size={14} /> LOCAL
            </button>

            <button className={`badge ${modeConnexion === "CLOUD" ? "green" : "dark"}`} onClick={() => setModeConnexion("CLOUD")}>
              <Cloud size={14} /> CLOUD MQTT
            </button>

            <input
              type="text"
              value={espIp}
              onChange={(e) => setEspIp(e.target.value)}
              disabled={modeConnexion === "CLOUD"}
              style={{
                padding: "10px 12px",
                borderRadius: "14px",
                background: "#0b1524",
                border: "1px solid var(--border)",
                color: "white",
                fontWeight: 700,
                maxWidth: "160px",
              }}
            />

            <button
              className="badge dark"
              onClick={() => {
                localStorage.setItem("esp_ip", espIp);
                ajouterPopup(`IP enregistrée : ${espIp}`, "blue");
              }}
            >
              CONNECTER IP
            </button>

            <div className={`badge ${systemOk ? "green" : "red"}`}>
              <div className={`dot ${systemOk ? "green" : "red"}`} />
              {systemOk ? "SYSTÈME NOMINAL" : "ERREUR / ARRÊT"}
            </div>

            <div className="admin">👤 ADMIN</div>

            <button className="icon-button" onClick={basculerSimulation} title="Simulation">
              <RefreshCw size={16} className={simulation ? "green-text" : ""} />
            </button>
          </div>
        </div>

        {urgence && <div className="big-alert danger">⚠️ ARRÊT D’URGENCE : SYSTÈME COUPÉ.</div>}
        {surchauffe && !urgence && <div className="big-alert danger">🚨 TEMPÉRATURE SEUIL ATTEINTE : LED ROUGE CLIGNOTANTE.</div>}
        {simulation && <div className="big-alert">🤖 MODE SIMULATION ACTIVÉ.</div>}
        {timerActif && <div className="big-alert">⏱️ MINUTERIE ACTIVE : temps restant {formatTemps(timerRestant)}.</div>}

        <div className="cards">
          <Card icon={<Thermometer size={24} />} title="TEMPÉRATURE ACTUELLE DU FOUR" value={`${temperature.toFixed(2)} °C`} note="Capteur DS18B20" color={surchauffe ? "red" : "blue"} />
          <Card icon={<Target size={24} />} title="TEMPÉRATURE DE RÉGULATION" value={`${tempRegulation} °C`} note={`Relance à -${margeRegulation}°C`} color="green" />
          <Card icon={<AlertTriangle size={24} />} title="TEMPÉRATURE DE SEUIL" value={`${tempSeuil} °C`} note="Sécurité thermique" color="red" />
          <Card icon={<Flame size={24} />} title="CHAUFFAGE" value={ledChauffage ? "ACTIF" : "INACTIF"} note={chauffageActif ? "Plaque réellement alimentée" : "Plaque coupée"} color={ledChauffage ? "green" : "gray"} />
          <Card icon={<Snowflake size={24} />} title="REFROIDISSEUR" value={refroidisseurOn ? "ACTIF" : "INACTIF"} note="Ventilateur" color={refroidisseurOn ? "blue" : "gray"} />
          <Card icon={<Clock size={24} />} title="MINUTERIE" value={timerActif ? formatTemps(timerRestant) : "NON ACTIVE"} note={fourOn ? "Réglable" : "Four éteint"} color={timerActif ? "blue" : "gray"} />
        </div>

        <div className="grid">
          <div ref={analyseRef} className="panel">
            <div className="panel-title">
              <div>
                <h3>ANALYSE THERMIQUE EN TEMPS RÉEL</h3>
                <p>Température réelle, régulation et seuil</p>
              </div>
            </div>

            <div style={{ width: "100%", height: 320, marginTop: 14 }}>
              <ResponsiveContainer>
                <LineChart data={graphData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="temps" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} domain={[(dataMin) => dataMin - 2, (dataMax) => dataMax + 5]} />
                  <Tooltip contentStyle={{ background: "#0b1524", borderColor: "#223246", color: "white" }} />
                  <ReferenceLine y={tempRegulation} stroke="var(--green)" strokeDasharray="5 5" />
                  <ReferenceLine y={tempSeuil} stroke="var(--red)" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="Temp" stroke="var(--blue)" strokeWidth={3} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="Regulation" stroke="var(--green)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="Seuil" stroke="var(--red)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <ControlPanel
            refProp={pilotageRef}
            envoyerCommande={envoyerCommande}
            changerRegulation={changerRegulation}
            changerSeuil={changerSeuil}
            tempRegulation={tempRegulation}
            tempSeuil={tempSeuil}
            fourOn={fourOn}
            dureeChoisie={dureeChoisie}
            setDureeChoisie={setDureeChoisie}
            appliquerTimer={appliquerTimer}
          />
        </div>

        <div ref={etatRef} className="panel" style={{ marginTop: "16px" }}>
          <div className="panel-title">
            <h3>ÉTAT DES COMPOSANTS</h3>
          </div>

          <StatusLine active={fourOn} title="Système four" activeText="Système démarré" inactiveText="Système arrêté" activeColor="green" />
          <StatusLine active={ledChauffage} title="Chauffage" activeText="Chauffage actif" inactiveText="Chauffage inactif" activeColor="green" />
          <StatusLine active={chauffageActif} title="Plaque thermique" activeText="Plaque alimentée" inactiveText="Plaque coupée" activeColor="green" />
          <StatusLine active={regulationAtteinte} title="Régulation" activeText="Température de régulation atteinte" inactiveText="Régulation non atteinte" activeColor="blue" />
          <StatusLine active={surchauffe} title="Température seuil" activeText="Seuil atteint : LED rouge clignote" inactiveText="Aucune surchauffe" activeColor="red" />
          <StatusLine active={refroidisseurOn} title="Refroidisseur" activeText="Refroidisseur actif" inactiveText="Refroidisseur inactif" activeColor="blue" />
        </div>

        <div ref={historiqueRef} className="panel history" style={{ marginTop: "16px" }}>
          <div className="panel-title">
            <div>
              <h3>JOURNAL DE TRAÇABILITÉ</h3>
              <p>Historique des commandes et modifications</p>
            </div>

            <button className="badge dark" style={{ cursor: "pointer", gap: 6 }} onClick={exporterCSV}>
              <Download size={14} /> EXPORT CSV
            </button>
          </div>

          {historique.length === 0 ? (
            <div className="empty-state">Aucune action enregistrée.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>HEURE</th>
                  <th>ACTION</th>
                  <th>CIBLE</th>
                  <th>MODE</th>
                </tr>
              </thead>

              <tbody>
                {historique.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: "monospace", color: "var(--muted)" }}>{String(log.id).slice(-6)}</td>
                    <td>{log.temps}</td>
                    <td className="blue-text" style={{ fontWeight: 600 }}>{log.action}</td>
                    <td>{log.cible}</td>
                    <td>{log.mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function ControlPanel({
  refProp,
  envoyerCommande,
  changerRegulation,
  changerSeuil,
  tempRegulation,
  tempSeuil,
  fourOn,
  dureeChoisie,
  setDureeChoisie,
  appliquerTimer,
}) {
  return (
    <div ref={refProp} className="panel control-panel">
      <div className="section-head">
        <h3>PILOTAGE DU SYSTÈME</h3>
        <small>Commandes locales ou cloud selon le mode choisi</small>
      </div>

      <div className="control-grid">
        <button className="btn on" onClick={() => envoyerCommande("/four/on", "FOUR_ON", "Démarrage du four thermique")}>
          <Power size={16} /> ALLUMER LE FOUR
        </button>

        <button className="btn off" onClick={() => envoyerCommande("/four/off", "FOUR_OFF", "Arrêt complet du four")}>
          <PowerOff size={16} /> ÉTEINDRE LE FOUR
        </button>

        <button className="btn blue" onClick={() => envoyerCommande("/refroidisseur/on", "FAN_ON", "Refroidisseur activé")}>
          <Snowflake size={16} /> ACTIVER REFROIDISSEUR
        </button>

        <button className="btn blue" onClick={() => envoyerCommande("/refroidisseur/off", "FAN_OFF", "Refroidisseur désactivé")}>
          <PowerOff size={16} /> DÉSACTIVER REFROIDISSEUR
        </button>
      </div>

      <hr style={{ borderColor: "#223246", margin: "20px 0" }} />

      <div className="section-head" style={{ marginBottom: "10px" }}>
        <h4>MINUTERIE DE FONCTIONNEMENT</h4>
        <small>Disponible seulement quand le four est allumé</small>
      </div>

      <div className="control-grid" style={{ marginBottom: "20px" }}>
        <input
          type="number"
          min="1"
          max="3600"
          value={dureeChoisie}
          disabled={!fourOn}
          onChange={(e) => setDureeChoisie(e.target.value)}
          style={{
            padding: "14px",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            background: "#0b1524",
            color: "white",
            fontWeight: 700,
            width: "100%",
          }}
        />

        <button className="btn blue" disabled={!fourOn} onClick={appliquerTimer}>
          <Clock size={16} /> APPLIQUER TEMPS
        </button>
      </div>

      <div className="section-head" style={{ marginBottom: "10px" }}>
        <h4>TEMPÉRATURE DE RÉGULATION</h4>
      </div>

      <div className="control-grid" style={{ marginBottom: "20px" }}>
        <div className="badge dark" style={{ justifyContent: "center" }}>
          Régulation : {tempRegulation}°C
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn blue" style={{ padding: "10px", flex: 1 }} onClick={() => changerRegulation(1)}>+</button>
          <button className="btn blue" style={{ padding: "10px", flex: 1 }} onClick={() => changerRegulation(-1)}>-</button>
        </div>
      </div>

      <div className="section-head" style={{ marginBottom: "10px" }}>
        <h4>TEMPÉRATURE DE SEUIL</h4>
      </div>

      <div className="control-grid">
        <div className="badge dark" style={{ justifyContent: "center" }}>
          Seuil : {tempSeuil}°C
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn blue" style={{ padding: "10px", flex: 1 }} onClick={() => changerSeuil(1)}>+</button>
          <button className="btn blue" style={{ padding: "10px", flex: 1 }} onClick={() => changerSeuil(-1)}>-</button>
        </div>
      </div>

      <button className="emergency" style={{ marginTop: "30px" }} onClick={() => envoyerCommande("/urgence", "URGENCE", "ARRÊT D’URGENCE OPÉRATEUR")}>
        <AlertTriangle size={18} /> ARRÊT D’URGENCE
      </button>
    </div>
  );
}

function Card({ icon, title, value, note, color = "blue" }) {
  return (
    <div className="card">
      <div className={`icon ${color}`}>{icon}</div>
      <div>
        <p>{title}</p>
        <h2 className={`${color}-text`}>{value}</h2>
        <small>{note}</small>
      </div>
    </div>
  );
}

function StatusLine({ active, title, activeText, inactiveText, activeColor }) {
  return (
    <div className="status-line">
      <div className={`lamp ${active ? activeColor : "red"}`} />
      <div>
        <h4>{title}</h4>
        <p>{active ? activeText : inactiveText}</p>
      </div>
    </div>
  );
}
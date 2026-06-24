import client from "./mqtt";
import React, { useState, useEffect, useRef, useMemo } from "react";
import "./App.css";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import emailjs from "@emailjs/browser";
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
  Sun,
  Moon,
  BellRing,
  Zap,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const now = () => new Date().toLocaleTimeString("fr-FR");

const THEME_KEY = "theme_scada";
const STATS_KEY = "stats_scada";
const PUISSANCE_CHAUFFAGE_KW = 1.5;

// IMPORTANT : remplace par ton vrai email
const EMAILJS_TO_EMAIL = "ton.email@gmail.com";

const EMAILJS_SERVICE_ID = "service_d7arbv3";
const EMAILJS_TEMPLATE_ID = "template_ke3tpa5";
const EMAILJS_PUBLIC_KEY = "GSlR0SAzp4jzKSYbW";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("auth_scada") === "true"
  );
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");

  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || "dark");
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default"
  );

  const [temperature, setTemperature] = useState(22);
  const [tempSeuil, setTempSeuil] = useState(30);
  const [tempRegulation, setTempRegulation] = useState(27);
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
  const [modeAuto, setModeAuto] = useState(true);

  const [timerActif, setTimerActif] = useState(false);
  const [timerTotal, setTimerTotal] = useState(0);
  const [timerRestant, setTimerRestant] = useState(0);

  const [espIp, setEspIp] = useState(
    localStorage.getItem("esp_ip") || "192.168.137.197"
  );
  const [modeConnexion, setModeConnexion] = useState(
    localStorage.getItem("mode_connexion") || "LOCAL"
  );
  const [statusReseau, setStatusReseau] = useState("Déconnecté");

  const [regulationInput, setRegulationInput] = useState("27");
  const [seuilInput, setSeuilInput] = useState("30");
  const [timerInput, setTimerInput] = useState("0");

  const [graphData, setGraphData] = useState([]);
  const [energyData, setEnergyData] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [popup, setPopup] = useState(null);

  const [statsSession, setStatsSession] = useState(() => {
    const saved = localStorage.getItem(STATS_KEY);
    return saved
      ? JSON.parse(saved)
      : {
          alertes: 0,
          urgences: 0,
          cyclesTermines: 0,
          tempsFonctionnementSec: 0,
        };
  });

  const [energyKWh, setEnergyKWh] = useState(0);

  const popupTimeoutRef = useRef(null);
  const previousFourOnRef = useRef(false);
  const previousFourStateRef = useRef(false);

  const dashboardRef = useRef(null);
  const analyseRef = useRef(null);
  const energyRef = useRef(null);
  const pilotageRef = useRef(null);
  const etatRef = useRef(null);
  const historiqueRef = useRef(null);
  const statsRef = useRef(null);

  const alerteSeuilEnvoyeeRef = useRef(false);
  const alerteUrgenceEnvoyeeRef = useRef(false);
  const rapportFinEnvoyeRef = useRef(false);

  const seConnecter = (e) => {
    e.preventDefault();

    if (loginUser === "NELVAROS" && loginPass === "99282227") {
      localStorage.setItem("auth_scada", "true");
      setIsAuthenticated(true);
      setLoginError("");
    } else {
      setLoginError("Identifiant ou mot de passe incorrect");
    }
  };

  const seDeconnecter = () => {
    localStorage.removeItem("auth_scada");
    setIsAuthenticated(false);
    setLoginUser("");
    setLoginPass("");
  };

  useEffect(() => {
    localStorage.setItem("esp_ip", espIp);
    localStorage.setItem("mode_connexion", modeConnexion);
  }, [espIp, modeConnexion]);

  useEffect(() => {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(STATS_KEY, JSON.stringify(statsSession));
  }, [statsSession]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (fourOn) {
        setStatsSession((prev) => ({
          ...prev,
          tempsFonctionnementSec: prev.tempsFonctionnementSec + 1,
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [fourOn]);

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

    setHistorique((prev) => [log, ...prev].slice(0, 1000));
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

  const notifierNavigateur = (titre, corps) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(titre, {
        body: corps,
        silent: false,
      });
    }
  };

  const activerNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      ajouterPopup("Notifications non supportées", "red");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    ajouterPopup(
      permission === "granted"
        ? "Notifications activées"
        : "Notifications refusées",
      permission === "granted" ? "blue" : "red"
    );
  };

  const getOperationalPoints = (data = graphData) => {
    if (!data.length) return [];
    if (data.length > 1 && Number(data[0]?.Temp) === 0) return data.slice(1);
    return data;
  };

  const analyserGraphique = () => {
    const operational = getOperationalPoints();

    if (operational.length === 0) {
      return {
        lignes: ["Aucune donnée de fonctionnement n'est disponible pour le graphe."],
        stats: [],
        minTemp: 0,
        maxTemp: 0,
        moyenneTemp: 0,
        startTemp: 0,
        endTemp: 0,
      };
    }

    const depart = operational[0];
    const fin = operational[operational.length - 1];
    const temperatures = operational.map((p) => Number(p.Temp));
    const maxTemp = Math.max(...temperatures);
    const minTemp = Math.min(...temperatures);
    const moyenneTemp =
      temperatures.reduce((acc, val) => acc + val, 0) / temperatures.length;
    const maxPoint = operational.find((p) => Number(p.Temp) === maxTemp);
    const minPoint = operational.find((p) => Number(p.Temp) === minTemp);
    const depassementsSeuil = operational.filter(
      (p) => Number(p.Temp) >= Number(tempSeuil)
    );
    const premierDepassement = depassementsSeuil[0];
    const pointsRegulation = operational.filter(
      (p) => Math.abs(Number(p.Temp) - Number(tempRegulation)) <= 0.5
    );
    const premierPointRegulation = pointsRegulation[0];
    const variation = Number(fin.Temp) - Number(depart.Temp);

    const lignes = [];
    lignes.push(
      `Le fonctionnement a commencé à ${depart.temps} avec une température réelle de ${Number(
        depart.Temp
      ).toFixed(2)} °C.`
    );
    lignes.push(
      `La température finale enregistrée à ${fin.temps} est de ${Number(fin.Temp).toFixed(
        2
      )} °C.`
    );
    lignes.push(
      `La température minimale observée est ${minTemp.toFixed(2)} °C à ${minPoint?.temps || "-"}.`
    );
    lignes.push(
      `La température maximale observée est ${maxTemp.toFixed(2)} °C à ${maxPoint?.temps || "-"}.`
    );
    lignes.push(
      `La température moyenne observée est ${moyenneTemp.toFixed(2)} °C.`
    );

    if (variation > 0) {
      lignes.push(
        `La tendance globale est une montée thermique de ${variation.toFixed(2)} °C sur la période analysée.`
      );
    } else if (variation < 0) {
      lignes.push(
        `La tendance globale est une baisse thermique de ${Math.abs(variation).toFixed(
          2
        )} °C sur la période analysée.`
      );
    } else {
      lignes.push("La température globale est restée stable sur la période analysée.");
    }

    if (premierDepassement) {
      lignes.push(
        `Le seuil critique a été atteint ou dépassé pour la première fois à ${premierDepassement.temps} avec ${Number(
          premierDepassement.Temp
        ).toFixed(2)} °C.`
      );
      lignes.push(
        `Nombre de mesures au-dessus ou au niveau du seuil : ${depassementsSeuil.length}.`
      );
    } else {
      lignes.push(
        "Aucun dépassement du seuil critique n'a été détecté pendant le fonctionnement."
      );
    }

    if (premierPointRegulation) {
      lignes.push(
        `La température de régulation a été atteinte ou approchée pour la première fois à ${premierPointRegulation.temps} avec ${Number(
          premierPointRegulation.Temp
        ).toFixed(2)} °C.`
      );
    } else {
      lignes.push(
        "La température de régulation n'a pas été clairement atteinte pendant l'enregistrement."
      );
    }

    return {
      lignes,
      stats: [
        ["Heure de début", depart.temps],
        ["Heure de fin", fin.temps],
        ["Température de départ", `${Number(depart.Temp).toFixed(2)} °C`],
        ["Température finale", `${Number(fin.Temp).toFixed(2)} °C`],
        ["Température minimale", `${minTemp.toFixed(2)} °C`],
        ["Température maximale", `${maxTemp.toFixed(2)} °C`],
        ["Température moyenne", `${moyenneTemp.toFixed(2)} °C`],
        ["Température de régulation", `${tempRegulation} °C`],
        ["Température de seuil", `${tempSeuil} °C`],
        ["Nombre de mesures", `${operational.length}`],
        ["Dépassements du seuil", `${depassementsSeuil.length}`],
      ],
      minTemp,
      maxTemp,
      moyenneTemp,
      startTemp: Number(depart.Temp),
      endTemp: Number(fin.Temp),
    };
  };

  const construireMail = (titreAlerte, typeAlerte) => {
    const analyse = analyserGraphique();
    const operational = getOperationalPoints();
    const depart = operational[0];

    return `
TITRE D'ALERTE :
${titreAlerte}

TYPE D'ALERTE :
${typeAlerte}

DATE ET HEURE :
${new Date().toLocaleString("fr-FR")}

TEMPÉRATURE :
${temperature.toFixed(2)} °C

MESSAGE :
${titreAlerte}

RÉSUMÉ DU FONCTIONNEMENT

Durée de fonctionnement :
${formatTemps(statsSession.tempsFonctionnementSec)}

Température de départ :
${depart ? `${Number(depart.Temp).toFixed(2)} °C` : "Non disponible"}

Température maximale :
${operational.length ? `${analyse.maxTemp.toFixed(2)} °C` : "Non disponible"}

Température minimale :
${operational.length ? `${analyse.minTemp.toFixed(2)} °C` : "Non disponible"}

Nombre d'alertes :
${statsSession.alertes}

Analyse :
${analyse.lignes.join("\n")}
    `.trim();
  };

  const envoyerAlerte = async (titre, typeAlerte) => {
    try {
      const message = construireMail(titre, typeAlerte);

      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: EMAILJS_TO_EMAIL,
        to_name: "NELVAROS",
        from_name: "SCADA NELVAROS",
        reply_to: EMAILJS_TO_EMAIL,
        subject: titre,
        title: titre,
        name: "NELVAROS",
        alert_title: titre,
        alert_type: typeAlerte,
        alert_temperature: `${temperature.toFixed(2)} °C`,
        alert_date: new Date().toLocaleString("fr-FR"),
        message,
      });

      ajouterHistorique(`Mail envoyé : ${titre}`, "EmailJS");
      ajouterPopup(`Mail envoyé : ${titre}`, "blue");
    } catch (err) {
      console.error("Erreur EmailJS :", err);
      ajouterHistorique(`Échec envoi mail : ${titre}`, "EmailJS");
      ajouterPopup("Erreur lors de l'envoi du mail", "red");
    }
  };

  const traiterDonneesESP32 = (data) => {
    const temp = Number(data.temperature ?? 0);
    const seuil = Number(data.tempSeuil ?? data.targetTemp ?? 30);
    const regulation = Number(data.tempRegulation ?? data.tempMaintien ?? 27);
    const nextFourOn = Boolean(data.fourOn);
    const nextCycles = Number(data.cycles ?? 0);
    const nextIp = data.ipAddress || "";

    setTemperature(temp);
    setTempSeuil(seuil);
    setTempRegulation(regulation);
    setMargeRegulation(Number(data.margeRegulation ?? 1));

    setFourOn(nextFourOn);
    setChauffageActif(Boolean(data.chauffageActif));
    setLedChauffage(Boolean(data.ledChauffage ?? data.chauffageActif));
    setRefroidisseurOn(Boolean(data.refroidisseurOn));
    setUrgence(Boolean(data.urgence));
    setSurchauffe(Boolean(data.surchauffe));
    setRegulationAtteinte(Boolean(data.regulationAtteinte));
    setSystemOk(Boolean(data.systemOk));
    setSimulation(Boolean(data.simulation));
    setCycles(nextCycles);
    setModeAuto(Boolean(data.modeAuto ?? true));

    setTimerActif(Boolean(data.timerActif));
    setTimerTotal(Number(data.timerTotal ?? 0));
    setTimerRestant(Number(data.timerRestant ?? 0));

    if (nextIp && nextIp !== espIp) {
      setEspIp(nextIp);
      localStorage.setItem("esp_ip", nextIp);
    }

    const estimatedKWh = Number(
      ((nextCycles * PUISSANCE_CHAUFFAGE_KW) / 3600).toFixed(4)
    );
    setEnergyKWh(estimatedKWh);

    setStatusReseau(
      modeConnexion === "LOCAL" ? "Local connecté HTTP" : "Cloud connecté MQTT"
    );

    const pointGraphique = {
      temps: now(),
      Temp: Number(temp.toFixed(2)),
      Regulation: regulation,
      Seuil: seuil,
    };

    setGraphData((prev) => {
      // À chaque démarrage du four, le graphe commence directement
      // avec la température réelle mesurée par le capteur au démarrage.
      // Régulation par défaut : 27 °C ; seuil par défaut : 30 °C.
      if (nextFourOn && !previousFourOnRef.current) {
        return [pointGraphique];
      }

      if (nextFourOn && previousFourOnRef.current) {
        return [...prev.slice(-799), pointGraphique];
      }

      if (!nextFourOn && previousFourOnRef.current) {
        return [...prev.slice(-799), pointGraphique];
      }

      return prev;
    });

    setEnergyData((prev) => {
      const point = {
        temps: now(),
        Consommation: estimatedKWh,
      };

      if (nextFourOn && !previousFourOnRef.current) {
        const pointZero = { temps: now(), Consommation: 0 };
        const prevCommenceAZero =
          prev.length > 0 && Number(prev[0]?.Consommation) === 0;

        return prevCommenceAZero
          ? [...prev.slice(-799), point]
          : [pointZero, point];
      }

      if (nextFourOn && previousFourOnRef.current) return [...prev.slice(-799), point];
      if (!nextFourOn && previousFourOnRef.current) return [...prev.slice(-799), point];
      return prev;
    });

    previousFourOnRef.current = nextFourOn;
  };

  useEffect(() => {
    const handleConnect = () => {
      client.subscribe("four/etat");
      if (modeConnexion === "CLOUD") {
        setStatusReseau("Cloud connecté MQTT");
      }
    };

    const handleMessage = (topic, message) => {
      if (topic === "four/etat") {
        try {
          const data = JSON.parse(message.toString());
          traiterDonneesESP32(data);
        } catch {
          ajouterPopup("Message MQTT non valide", "red");
        }
      }
    };

    const handleOffline = () => {
      if (modeConnexion === "CLOUD") setStatusReseau("Cloud hors ligne");
    };

    const handleError = () => {
      if (modeConnexion === "CLOUD") setStatusReseau("Erreur cloud MQTT");
    };

    client.on("connect", handleConnect);
    client.on("message", handleMessage);
    client.on("offline", handleOffline);
    client.on("error", handleError);

    if (client.connected) {
      client.subscribe("four/etat");
      if (modeConnexion === "CLOUD") setStatusReseau("Cloud connecté MQTT");
    }

    return () => {
      client.removeListener("connect", handleConnect);
      client.removeListener("message", handleMessage);
      client.removeListener("offline", handleOffline);
      client.removeListener("error", handleError);
    };
  }, [modeConnexion, espIp]);

  useEffect(() => {
    if (modeConnexion !== "LOCAL") return;

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

  useEffect(() => {
    if (modeConnexion === "CLOUD") {
      setStatusReseau(client.connected ? "Cloud connecté MQTT" : "Connexion cloud...");
      client.subscribe("four/etat");
    }
  }, [modeConnexion]);

  // mail uniquement seuil atteint
  useEffect(() => {
    const depassementSeuil = surchauffe || temperature >= tempSeuil;

    if (depassementSeuil && !alerteSeuilEnvoyeeRef.current) {
      envoyerAlerte("TEMPÉRATURE DE SEUIL ATTEINTE", "TEMPÉRATURE DE SEUIL");

      setStatsSession((prev) => ({
        ...prev,
        alertes: prev.alertes + 1,
      }));

      notifierNavigateur(
        "Alerte thermique",
        `Seuil atteint : ${temperature.toFixed(2)} °C`
      );

      alerteSeuilEnvoyeeRef.current = true;
    }

    if (!depassementSeuil) {
      alerteSeuilEnvoyeeRef.current = false;
    }
  }, [surchauffe, temperature, tempSeuil]);

  // mail uniquement urgence
  useEffect(() => {
    if (urgence && !alerteUrgenceEnvoyeeRef.current) {
      envoyerAlerte("ARRÊT D'URGENCE DÉCLENCHÉ", "ARRÊT D'URGENCE");

      setStatsSession((prev) => ({
        ...prev,
        alertes: prev.alertes + 1,
        urgences: prev.urgences + 1,
      }));

      notifierNavigateur(
        "Arrêt d'urgence",
        "Le système a déclenché un arrêt d'urgence."
      );

      alerteUrgenceEnvoyeeRef.current = true;
    }

    if (!urgence) {
      alerteUrgenceEnvoyeeRef.current = false;
    }
  }, [urgence]);

  // mail uniquement extinction du four
  useEffect(() => {
    if (previousFourStateRef.current && !fourOn && !rapportFinEnvoyeRef.current) {
      envoyerAlerte("RAPPORT COMPLET D'EXTINCTION DU FOUR", "EXTINCTION DU FOUR");

      setStatsSession((prev) => ({
        ...prev,
        cyclesTermines: prev.cyclesTermines + 1,
      }));

      notifierNavigateur(
        "Cycle terminé",
        "Le four est complètement éteint. Rapport envoyé."
      );

      ajouterPopup("Cycle thermique terminé", "blue");
      rapportFinEnvoyeRef.current = true;
    }

    if (fourOn) {
      rapportFinEnvoyeRef.current = false;
    }

    previousFourStateRef.current = fourOn;
  }, [fourOn]);

  const envoyerCommande = (routeLocal, commandeMqtt, description) => {
    ajouterHistorique(description);

    if (commandeMqtt === "FOUR_ON") {
      // Valeurs par défaut au démarrage du four.
      // Le graphe thermique démarre avec la température réelle mesurée
      // par le capteur au moment de l'allumage.
      setTempRegulation(27);
      setTempSeuil(30);
      setTimerRestant(0);
      setTimerActif(false);
      setRegulationInput("27");
      setSeuilInput("30");
      setTimerInput("0");
      setGraphData([]);
      setEnergyData([{ temps: now(), Consommation: 0 }]);
      setEnergyKWh(0);
      previousFourOnRef.current = false;
      rapportFinEnvoyeRef.current = false;
    }

    if (modeConnexion === "CLOUD") {
      if (client.connected) {
        client.publish("four/commande", commandeMqtt);
        ajouterPopup("Commande envoyée en cloud MQTT", "blue");
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

  const appliquerRegulation = () => {
    const valeur = Number(regulationInput || 0);

    envoyerCommande(
      `/set/regulation?val=${valeur}`,
      `SET_REGULATION:${valeur}`,
      `Température de régulation réglée à ${valeur}°C`
    );
  };

  const appliquerSeuil = () => {
    const valeur = Number(seuilInput || 0);

    envoyerCommande(
      `/set/seuil?val=${valeur}`,
      `SET_SEUIL:${valeur}`,
      `Température de seuil réglée à ${valeur}°C`
    );
  };

  const appliquerTimer = () => {
    const secondes = Number(timerInput || 0);

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

  const statsResume = useMemo(() => {
    const operational = getOperationalPoints();

    if (!operational.length) {
      return {
        max: "--",
        min: "--",
        moyenne: "--",
        alertes: statsSession.alertes,
        urgences: statsSession.urgences,
        cyclesTermines: statsSession.cyclesTermines,
        temps: formatTemps(statsSession.tempsFonctionnementSec),
        chauffe: formatTemps(cycles),
        energie: `${energyKWh.toFixed(3)} kWh`,
      };
    }

    const valeurs = operational.map((p) => Number(p.Temp));
    const somme = valeurs.reduce((acc, v) => acc + v, 0);

    return {
      max: `${Math.max(...valeurs).toFixed(2)} °C`,
      min: `${Math.min(...valeurs).toFixed(2)} °C`,
      moyenne: `${(somme / valeurs.length).toFixed(2)} °C`,
      alertes: statsSession.alertes,
      urgences: statsSession.urgences,
      cyclesTermines: statsSession.cyclesTermines,
      temps: formatTemps(statsSession.tempsFonctionnementSec),
      chauffe: formatTemps(cycles),
      energie: `${energyKWh.toFixed(3)} kWh`,
    };
  }, [graphData, statsSession, cycles, energyKWh]);

  const ajouterTexteMultiPages = (doc, texte, startY) => {
    const lignes = doc.splitTextToSize(texte, 182);
    let y = startY;

    lignes.forEach((ligne) => {
      if (y > 282) {
        doc.addPage();
        y = 18;
      }
      doc.text(ligne, 14, y);
      y += 5;
    });

    return y;
  };

  const ajouterImageAvecSaut = async (doc, ref, yStart, height) => {
    if (!ref.current) return yStart;

    const canvas = await html2canvas(ref.current, {
      backgroundColor: "#020617",
      scale: 2,
    });
    const imgData = canvas.toDataURL("image/png");

    let y = yStart;
    if (y + height > 280) {
      doc.addPage();
      y = 18;
    }

    doc.addImage(imgData, "PNG", 14, y, 182, height);
    return y + height + 8;
  };

  const exporterRapportGraphiquePDF = async () => {
    if (graphData.length === 0) {
      ajouterPopup("Aucune donnée de graphe à exporter", "red");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");
    const analyse = analyserGraphique();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("PROJET NELVAROS LP SARII", 14, 16);

    doc.setFontSize(13);
    doc.text("Rapport d'analyse thermique complet", 14, 25);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Date d'export : ${new Date().toLocaleString("fr-FR")}`, 14, 32);
    doc.text(`Mode de connexion : ${modeConnexion}`, 14, 38);
    doc.text(`Mode système : ${modeAuto ? "AUTOMATIQUE" : "MANUEL"}`, 14, 44);
    doc.text(`IP ESP32 : ${espIp}`, 14, 50);

    let currentY = 58;

    currentY = await ajouterImageAvecSaut(doc, analyseRef, currentY, 78);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    if (currentY > 270) {
      doc.addPage();
      currentY = 18;
    }
    doc.text("Courbe de consommation énergétique", 14, currentY);
    currentY += 6;

    currentY = await ajouterImageAvecSaut(doc, energyRef, currentY, 72);

    if (currentY > 250) {
      doc.addPage();
      currentY = 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Résumé des mesures", 14, currentY);

    autoTable(doc, {
      startY: currentY + 5,
      head: [["Indicateur", "Valeur"]],
      body: analyse.stats,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [240, 246, 255] },
    });

    let yAnalyse = doc.lastAutoTable.finalY + 10;

    if (yAnalyse > 250) {
      doc.addPage();
      yAnalyse = 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Analyse automatique", 14, yAnalyse);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const texteAnalyse = [
      ...analyse.lignes,
      "",
      `Consommation estimée : ${energyKWh.toFixed(3)} kWh`,
      `Temps de fonctionnement : ${formatTemps(statsSession.tempsFonctionnementSec)}`,
      `Temps de chauffe cumulé : ${formatTemps(cycles)}`,
      "",
      "Historique des actions :",
      ...historique
        .slice(0, 150)
        .reverse()
        .map((log) => `${log.temps} | ${log.action} | ${log.cible} | ${log.mode}`),
    ].join("\n");

    ajouterTexteMultiPages(doc, texteAnalyse, yAnalyse + 7);
    doc.save(`rapport_graphique_nelvaros_${Date.now()}.pdf`);
  };

  const exporterJournalPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("PROJET NELVAROS LP SARII", 14, 16);

    doc.setFontSize(13);
    doc.text("Journal de traçabilité", 14, 25);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Date d'export : ${new Date().toLocaleString("fr-FR")}`, 14, 32);
    doc.text(`Mode de connexion : ${modeConnexion}`, 14, 38);
    doc.text(`Mode système : ${modeAuto ? "AUTOMATIQUE" : "MANUEL"}`, 14, 44);
    doc.text(`Nombre d'actions enregistrées : ${historique.length}`, 14, 50);

    const lignes = historique.map((log) => [
      String(log.id).slice(-6),
      log.temps,
      log.action,
      log.cible,
      log.mode,
    ]);

    autoTable(doc, {
      startY: 58,
      head: [["ID", "HEURE", "ACTION", "CIBLE", "MODE"]],
      body: lignes.length ? lignes : [["-", "-", "Aucune action enregistrée", "-", "-"]],
      styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [240, 246, 255] },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 28 },
        2: { cellWidth: 78 },
        3: { cellWidth: 30 },
        4: { cellWidth: 28 },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: () => {
        const page = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.text(`Page ${page}`, 185, 287);
      },
    });

    doc.save(`journal_tracabilite_nelvaros_${Date.now()}.pdf`);
  };

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#020617",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <form
          onSubmit={seConnecter}
          style={{
            width: "390px",
            background: "#0b1524",
            border: "1px solid #223246",
            borderRadius: "24px",
            padding: "35px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          }}
        >
          <h1 style={{ color: "#38bdf8", marginBottom: "10px" }}>
            PROJET NELVAROS
          </h1>

          <p style={{ color: "#94a3b8", marginBottom: "25px" }}>
            LP SARII - Accès sécurisé
          </p>

          <label>Nom d’utilisateur</label>
          <input
            type="text"
            value={loginUser}
            onChange={(e) => setLoginUser(e.target.value)}
            placeholder="NELVAROS"
            style={{
              width: "100%",
              padding: "14px",
              margin: "8px 0 18px",
              borderRadius: "12px",
              border: "1px solid #334155",
              background: "#020617",
              color: "white",
              fontSize: "16px",
            }}
          />

          <label>Mot de passe</label>
          <input
            type="password"
            value={loginPass}
            onChange={(e) => setLoginPass(e.target.value)}
            placeholder="Mot de passe"
            style={{
              width: "100%",
              padding: "14px",
              margin: "8px 0 18px",
              borderRadius: "12px",
              border: "1px solid #334155",
              background: "#020617",
              color: "white",
              fontSize: "16px",
            }}
          />

          {loginError && (
            <p style={{ color: "#ef4444", fontWeight: "bold" }}>
              {loginError}
            </p>
          )}

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "15px",
              borderRadius: "14px",
              border: "none",
              background: "#16a34a",
              color: "white",
              fontWeight: "bold",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            SE CONNECTER
          </button>
        </form>
      </div>
    );
  }

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
            <h2>PROJET NELVAROS</h2>
            <p>LP SARII</p>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          <button onClick={() => scrollToSection(dashboardRef)}>
            <LayoutDashboard size={16} /> Tableau de bord
          </button>

          <button onClick={() => scrollToSection(analyseRef)}>
            <BarChart3 size={16} /> Analyse thermique
          </button>

          <button onClick={() => scrollToSection(statsRef)}>
            <Activity size={16} /> Statistiques
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
          <Cpu
            size={24}
            className={
              statusReseau.includes("connecté") ? "green-text" : "red-text"
            }
          />
          <div>
            <p style={{ fontSize: "13px" }}>ESP32 STATUS</p>
            <small>{statusReseau}</small>
          </div>
        </div>
      </div>

      <div className="main">
        <div ref={dashboardRef} className="header">
          <div>
            <h1>PROJET NELVAROS LP SARII</h1>
            <p>
              Supervision thermique avec mode manuel, mode automatique,
              statistiques, notifications, mail et export PDF.
            </p>
          </div>

          <div className="header-actions">
            <button
              className={`badge ${modeConnexion === "LOCAL" ? "green" : "dark"}`}
              onClick={() => setModeConnexion("LOCAL")}
            >
              <Wifi size={14} /> LOCAL
            </button>

            <button
              className={`badge ${modeConnexion === "CLOUD" ? "green" : "dark"}`}
              onClick={() => setModeConnexion("CLOUD")}
            >
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
                maxWidth: "170px",
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

            <div className="badge dark">
              {modeAuto ? "MODE AUTO" : "MODE MANUEL"}
            </div>

            <button
              className="icon-button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Mode clair" : "Mode sombre"}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              className="icon-button"
              onClick={activerNotifications}
              title="Notifications navigateur"
            >
              <BellRing
                size={16}
                className={notificationPermission === "granted" ? "green-text" : ""}
              />
            </button>

            <button
              className="icon-button"
              onClick={basculerSimulation}
              title="Simulation"
            >
              <RefreshCw size={16} className={simulation ? "green-text" : ""} />
            </button>

            <button className="admin" onClick={seDeconnecter}>
              👤 NELVAROS | DÉCONNEXION
            </button>
          </div>
        </div>

        {urgence && (
          <div className="big-alert danger">
            ⚠️ ARRÊT D’URGENCE : SYSTÈME COUPÉ.
          </div>
        )}

        {surchauffe && !urgence && (
          <div className="big-alert danger">
            🚨 TEMPÉRATURE DE SEUIL ATTEINTE : alarme clignotante active.
          </div>
        )}

        {simulation && <div className="big-alert">🤖 MODE SIMULATION ACTIVÉ.</div>}

        {timerActif && (
          <div className="big-alert">
            ⏱️ MINUTERIE ACTIVE : temps restant {formatTemps(timerRestant)}.
          </div>
        )}

        <div className="cards">
          <Card
            icon={<Thermometer size={24} />}
            title="TEMPÉRATURE ACTUELLE DU FOUR"
            value={`${temperature.toFixed(2)} °C`}
            note="Capteur DS18B20"
            color={surchauffe ? "red" : "blue"}
          />

          <Card
            icon={<Target size={24} />}
            title="TEMPÉRATURE DE RÉGULATION"
            value={`${tempRegulation} °C`}
            note="Valeur cible"
            color="green"
          />

          <Card
            icon={<AlertTriangle size={24} />}
            title="TEMPÉRATURE DE SEUIL"
            value={`${tempSeuil} °C`}
            note="Sécurité thermique"
            color="red"
          />

          <Card
            icon={<Flame size={24} />}
            title="CHAUFFAGE"
            value={ledChauffage ? "ACTIF" : "INACTIF"}
            note={chauffageActif ? "Plaque réellement alimentée" : "Voyant logique chauffage"}
            color={ledChauffage ? "green" : "gray"}
          />

          <Card
            icon={<Snowflake size={24} />}
            title="REFROIDISSEUR"
            value={refroidisseurOn ? "ACTIF" : "INACTIF"}
            note="Ventilateur"
            color={refroidisseurOn ? "blue" : "gray"}
          />

          <Card
            icon={<Clock size={24} />}
            title="MINUTERIE"
            value={timerActif ? formatTemps(timerRestant) : "NON ACTIVE"}
            note={fourOn ? "Réglable" : "Système éteint"}
            color={timerActif ? "blue" : "gray"}
          />
        </div>

        <div className="grid">
          <div className="panel">
            <div className="panel-title">
              <div>
                <h3>ANALYSE THERMIQUE EN TEMPS RÉEL</h3>
                <p>Courbe des variations de température en temps réel</p>
              </div>

              <button
                className="badge dark"
                style={{ cursor: "pointer", gap: 6 }}
                onClick={exporterRapportGraphiquePDF}
              >
                <Download size={14} /> RAPPORT GRAPHIQUE PDF
              </button>
            </div>

            <div ref={analyseRef} style={{ width: "100%", height: 320, marginTop: 14 }}>
              <ResponsiveContainer>
                <LineChart data={graphData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="temps"
                    stroke="#6b7280"
                    fontSize={11}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={11}
                    domain={[(dataMin) => dataMin - 2, (dataMax) => dataMax + 5]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0b1524",
                      borderColor: "#223246",
                      color: "white",
                    }}
                  />
                  <Line
                    type="natural"
                    dataKey="Temp"
                    stroke="var(--blue)"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="natural"
                    dataKey="Regulation"
                    stroke="var(--green)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="natural"
                    dataKey="Seuil"
                    stroke="var(--red)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <ControlPanel
            refProp={pilotageRef}
            envoyerCommande={envoyerCommande}
            appliquerRegulation={appliquerRegulation}
            appliquerSeuil={appliquerSeuil}
            appliquerTimer={appliquerTimer}
            regulationInput={regulationInput}
            setRegulationInput={setRegulationInput}
            seuilInput={seuilInput}
            setSeuilInput={setSeuilInput}
            timerInput={timerInput}
            setTimerInput={setTimerInput}
            fourOn={fourOn}
            modeAuto={modeAuto}
          />
        </div>

        <div ref={etatRef} className="panel" style={{ marginTop: "16px" }}>
          <div className="panel-title">
            <h3>ÉTAT DES COMPOSANTS</h3>
          </div>

          <StatusLine
            active={fourOn}
            title="Système four"
            activeText="Système démarré"
            inactiveText="Système arrêté"
            activeColor="green"
          />
          <StatusLine
            active={ledChauffage}
            title="Lumière chauffage"
            activeText="Voyant chauffage allumé"
            inactiveText="Voyant chauffage éteint"
            activeColor="green"
          />
          <StatusLine
            active={chauffageActif}
            title="Plaque thermique"
            activeText="Plaque alimentée"
            inactiveText="Plaque coupée"
            activeColor="green"
          />
          <StatusLine
            active={regulationAtteinte}
            title="Régulation"
            activeText="Température de régulation atteinte"
            inactiveText="Régulation non atteinte"
            activeColor="blue"
          />
          <StatusLine
            active={surchauffe}
            title="Température seuil"
            activeText="Seuil atteint : alarme clignotante"
            inactiveText="Aucune surchauffe"
            activeColor="red"
          />
          <StatusLine
            active={refroidisseurOn}
            title="Refroidisseur"
            activeText="Refroidisseur actif"
            inactiveText="Refroidisseur inactif"
            activeColor="blue"
          />
        </div>

        <div ref={statsRef} className="panel" style={{ marginTop: "16px" }}>
          <div className="panel-title">
            <div>
              <h3>PAGE STATISTIQUES</h3>
              <p>Indicateurs cumulés de la session</p>
            </div>

            <div className="panel-tag">
              {notificationPermission === "granted"
                ? "Notifications actives"
                : "Notifications inactives"}
            </div>
          </div>

          <div className="cards stats-cards">
            <Card
              icon={<Thermometer size={24} />}
              title="TEMPÉRATURE MAX"
              value={statsResume.max}
              note="Session courante"
              color="red"
            />
            <Card
              icon={<Thermometer size={24} />}
              title="TEMPÉRATURE MIN"
              value={statsResume.min}
              note="Session courante"
              color="blue"
            />
            <Card
              icon={<BarChart3 size={24} />}
              title="TEMPÉRATURE MOYENNE"
              value={statsResume.moyenne}
              note="Moyenne calculée"
              color="green"
            />
            <Card
              icon={<AlertTriangle size={24} />}
              title="NOMBRE D'ALERTES"
              value={String(statsResume.alertes)}
              note="Seuil + urgences"
              color="orange"
            />
            <Card
              icon={<AlertTriangle size={24} />}
              title="ARRÊTS D'URGENCE"
              value={String(statsResume.urgences)}
              note="Déclenchements enregistrés"
              color="red"
            />
            <Card
              icon={<Clock size={24} />}
              title="TEMPS DE FONCTIONNEMENT"
              value={statsResume.temps}
              note="Système alimenté"
              color="blue"
            />
            <Card
              icon={<Flame size={24} />}
              title="TEMPS DE CHAUFFE"
              value={statsResume.chauffe}
              note="Plaque réellement active"
              color="green"
            />
            <Card
              icon={<Zap size={24} />}
              title="CONSOMMATION ESTIMÉE"
              value={statsResume.energie}
              note={`Base ${PUISSANCE_CHAUFFAGE_KW} kW`}
              color="orange"
            />
            <Card
              icon={<RefreshCw size={24} />}
              title="CYCLES TERMINÉS"
              value={String(statsResume.cyclesTermines)}
              note="Cycles clôturés"
              color="blue"
            />
          </div>
        </div>

        <div className="panel" style={{ marginTop: "16px" }}>
          <div className="panel-title">
            <div>
              <h3>COURBE DE CONSOMMATION ÉNERGÉTIQUE ESTIMÉE</h3>
              <p>
                Estimation basée sur une puissance chauffage de {PUISSANCE_CHAUFFAGE_KW} kW
              </p>
            </div>

            <div className="panel-tag">{statsResume.energie}</div>
          </div>

          {energyData.length === 0 ? (
            <div className="empty-state">
              Aucune donnée énergétique disponible.
            </div>
          ) : (
            <div ref={energyRef} style={{ width: "100%", height: 280, marginTop: 14 }}>
              <ResponsiveContainer>
                <LineChart data={energyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="temps"
                    stroke="#6b7280"
                    fontSize={11}
                    interval="preserveStartEnd"
                  />
                  <YAxis stroke="#6b7280" fontSize={11} unit=" kWh" />
                  <Tooltip
                    contentStyle={{
                      background: "#0b1524",
                      borderColor: "#223246",
                      color: "white",
                    }}
                  />
                  <Line
                    type="natural"
                    dataKey="Consommation"
                    stroke="var(--orange)"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div
          ref={historiqueRef}
          className="panel history"
          style={{ marginTop: "16px" }}
        >
          <div className="panel-title">
            <div>
              <h3>JOURNAL DE TRAÇABILITÉ</h3>
              <p>Historique des commandes et modifications</p>
            </div>

            <button
              className="badge dark"
              style={{ cursor: "pointer", gap: 6 }}
              onClick={exporterJournalPDF}
            >
              <Download size={14} /> JOURNAL PDF
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
                    <td style={{ fontFamily: "monospace", color: "var(--muted)" }}>
                      {String(log.id).slice(-6)}
                    </td>
                    <td>{log.temps}</td>
                    <td className="blue-text" style={{ fontWeight: 600 }}>
                      {log.action}
                    </td>
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
  appliquerRegulation,
  appliquerSeuil,
  appliquerTimer,
  regulationInput,
  setRegulationInput,
  seuilInput,
  setSeuilInput,
  timerInput,
  setTimerInput,
  fourOn,
  modeAuto,
}) {
  const manualDisabled = !fourOn || modeAuto;

  return (
    <div ref={refProp} className="panel control-panel">
      <div className="section-head">
        <h3>PILOTAGE DU SYSTÈME</h3>
        <small>Allumer le système avant toute manipulation</small>
      </div>

      <div className="control-grid" style={{ marginBottom: "18px" }}>
        <button
          className={`btn ${modeAuto ? "on" : "blue"}`}
          onClick={() =>
            envoyerCommande("/mode/auto", "MODE_AUTO", "Passage en mode automatique")
          }
        >
          MODE AUTO
        </button>

        <button
          className={`btn ${!modeAuto ? "on" : "blue"}`}
          onClick={() =>
            envoyerCommande("/mode/manuel", "MODE_MANUEL", "Passage en mode manuel")
          }
        >
          MODE MANUEL
        </button>
      </div>

      <div className="control-grid">
        <button
          className="btn on"
          onClick={() =>
            envoyerCommande("/four/on", "FOUR_ON", "Alimentation système activée")
          }
        >
          <Power size={16} /> ALLUMER LE FOUR
        </button>

        <button
          className="btn off"
          disabled={!fourOn}
          onClick={() =>
            envoyerCommande("/four/off", "FOUR_OFF", "Alimentation système coupée")
          }
        >
          <PowerOff size={16} /> ÉTEINDRE LE FOUR
        </button>

        <button
          className="btn blue"
          disabled={manualDisabled}
          onClick={() =>
            envoyerCommande("/chauffage/on", "HEATER_ON", "Chauffage manuel activé")
          }
        >
          <Flame size={16} /> ACTIVER CHAUFFAGE
        </button>

        <button
          className="btn blue"
          disabled={manualDisabled}
          onClick={() =>
            envoyerCommande("/chauffage/off", "HEATER_OFF", "Chauffage manuel coupé")
          }
        >
          <PowerOff size={16} /> COUPER CHAUFFAGE
        </button>

        <button
          className="btn blue"
          disabled={manualDisabled}
          onClick={() =>
            envoyerCommande("/refroidisseur/on", "FAN_ON", "Refroidisseur manuel activé")
          }
        >
          <Snowflake size={16} /> ACTIVER REFROIDISSEUR
        </button>

        <button
          className="btn blue"
          disabled={manualDisabled}
          onClick={() =>
            envoyerCommande("/refroidisseur/off", "FAN_OFF", "Refroidisseur manuel coupé")
          }
        >
          <PowerOff size={16} /> DÉSACTIVER REFROIDISSEUR
        </button>
      </div>

      <hr style={{ borderColor: "#223246", margin: "20px 0" }} />

      <div className="section-head" style={{ marginBottom: "10px" }}>
        <h4>TEMPS DE FONCTIONNEMENT</h4>
        <small>Valeur libre</small>
      </div>

      <div className="control-grid" style={{ marginBottom: "20px" }}>
        <input
          type="number"
          value={timerInput}
          onChange={(e) => setTimerInput(e.target.value)}
          disabled={!fourOn}
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
        <input
          type="number"
          value={regulationInput}
          onChange={(e) => setRegulationInput(e.target.value)}
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
        <button className="btn blue" onClick={appliquerRegulation}>
          APPLIQUER RÉGULATION
        </button>
      </div>

      <div className="section-head" style={{ marginBottom: "10px" }}>
        <h4>TEMPÉRATURE DE SEUIL</h4>
      </div>

      <div className="control-grid">
        <input
          type="number"
          value={seuilInput}
          onChange={(e) => setSeuilInput(e.target.value)}
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
        <button className="btn blue" onClick={appliquerSeuil}>
          APPLIQUER SEUIL
        </button>
      </div>

      <button
        className="emergency"
        style={{ marginTop: "30px" }}
        disabled={!fourOn}
        onClick={() =>
          envoyerCommande("/urgence", "URGENCE", "ARRÊT D’URGENCE OPÉRATEUR")
        }
      >
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

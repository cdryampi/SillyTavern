import {
    extension_settings,
    getContext,
} from "../../../extensions.js";
// Toastr is global in SillyTavern

const extensionName = "antigravity";

// Configuración por defecto
const defaultSettings = {
    sourceUrl: "https://api.npoint.io/d591176bd0f49d59dbba", // URL del JSON o Endpoint
};

let settings = defaultSettings;

function normalizeKoboldEndpoint(urlString) {
    const parsed = new URL(urlString);
    const normalizedPath = parsed.pathname.replace(/\/+$/, "");

    if (!normalizedPath || normalizedPath === "/") {
        parsed.pathname = "/api";
    } else if (normalizedPath === "/v1" || normalizedPath === "/api/v1") {
        parsed.pathname = "/api";
    } else {
        parsed.pathname = normalizedPath;
    }

    return parsed.toString();
}

function setInputValue(id, value) {
    const input = document.getElementById(id);
    if (!input) {
        return false;
    }

    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
}

async function loadSettings() {
    settings = Object.assign({}, defaultSettings, extension_settings[extensionName]);
}

async function saveSettings() {
    extension_settings[extensionName] = settings;
    getContext().saveSettingsDebounced();
}

async function fetchAndConnect() {
    if (!settings.sourceUrl) {
        toastr.warning("Por favor configura la URL de origen.", "Antigravity");
        // Abrir popup automáticamente si falta la URL
        const popup = document.getElementById("antigravity-settings");
        if (popup) popup.classList.remove("hidden");
        return;
    }

    const connectBtn = document.getElementById("antigravity-connect-btn");
    const icon = connectBtn?.querySelector("i");

    // Indicador de carga
    if (icon) {
        icon.classList.remove("fa-link");
        icon.classList.add("fa-spinner", "fa-spin");
    }

    try {
        toastr.info("Buscando nueva URL...", "Antigravity");

        // Intentamos fetch
        const response = await fetch(settings.sourceUrl, {
            cache: "no-cache"
        });

        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

        // Asumimos que la fuente devuelve:
        // 1. Un JSON con campo { "content": "https://..." } (Estilo Discord Message)
        // 2. O texto plano con la URL
        const text = await response.text();
        let newUrl = "";

        try {
            const json = JSON.parse(text);
            // Intenta buscar campos comunes
            newUrl = json.content || json.url || json.api_url;
        } catch (e) {
            // Si falla JSON, usamos el texto entero
            newUrl = text.trim();
        }

        // Limpieza básica: extraer primera URL si hay texto alrededor
        const urlMatch = newUrl.match(/https?:\/\/[^\s"'<>()[\]{}]+/);
        if (urlMatch) {
            newUrl = urlMatch[0];
        }

        if (!newUrl.startsWith("http")) {
            throw new Error("No se encontró una URL válida en la respuesta.");
        }

        const normalizedUrl = normalizeKoboldEndpoint(newUrl);
        toastr.success(`URL encontrada: ${normalizedUrl}`, "Antigravity");

        let updatedInputs = 0;
        if (setInputValue("koboldcpp_api_url_text", normalizedUrl)) updatedInputs++;
        if (setInputValue("api_url_text", normalizedUrl)) updatedInputs++;
        if (setInputValue("api_url_textgeneration", normalizedUrl)) updatedInputs++;
        if (setInputValue("textgenerationwebui_api_url_text", normalizedUrl)) updatedInputs++;

        const mainApi = document.getElementById("main_api")?.value;
        let triggeredConnect = false;

        if (mainApi === "textgenerationwebui") {
            const textgenType = document.getElementById("textgen_type");
            if (textgenType) {
                textgenType.value = "koboldcpp";
                textgenType.dispatchEvent(new Event("change", { bubbles: true }));
                triggeredConnect = true;
            }

            if (!triggeredConnect) {
                const textgenBtn = document.getElementById("api_button_textgenerationwebui");
                if (textgenBtn) {
                    setTimeout(() => textgenBtn.click(), 500);
                    triggeredConnect = true;
                }
            }
        } else if (mainApi === "kobold") {
            const koboldBtn = document.getElementById("api_button");
            if (koboldBtn) {
                setTimeout(() => koboldBtn.click(), 500);
                triggeredConnect = true;
            }
        } else {
            const fallbackBtn = document.getElementById("api_button_textgenerationwebui")
                || document.getElementById("api_button")
                || document.getElementById("api_button_textgeneration");
            if (fallbackBtn) {
                setTimeout(() => fallbackBtn.click(), 500);
                triggeredConnect = true;
            }
        }

        if (updatedInputs === 0) {
            toastr.error("No se encontró ningún campo de URL API. Abre la sección de conexión del backend.", "Antigravity");
        } else if (triggeredConnect) {
            toastr.success("Intentando reconectar...", "Antigravity");
        } else {
            toastr.warning("URL actualizada, pero no encontré el botón de conectar.", "Antigravity");
        }

    } catch (err) {
        console.error(err);
        toastr.error(`Error: ${err.message}`, "Antigravity Falló");
    } finally {
        if (icon) {
            icon.classList.remove("fa-spinner", "fa-spin");
            icon.classList.add("fa-link");
        }
    }
}

function createUi() {
    // 1. Botón en la Barra Superior (junto a otros iconos)
    // Buscamos el contenedor de iconos de la derecha (depende de la versión de ST, suele ser #extensions_menu o similar,
    // pero para estar seguros lo pondremos flotante o en el drawer de extensiones)

    // Método seguro: Añadir a la lista de extensiones o crear un botón flotante discreto.
    // Vamos a inyectarlo en el panel de conexiones API si es posible, o en el top bar.

    // Crearemos un botón flotante simple para este MVP en la esquina superior izquierda
    const container = document.createElement("div");
    container.id = "antigravity-container";
    container.innerHTML = `
        <div id="antigravity-connect-btn" class="menu_button" title="Sync Antigravity">
            <i class="fa-solid fa-link"></i>
        </div>
        <div id="antigravity-settings" class="antigravity-popup hidden">
            <label>Fuente URL (Discord JSON/Raw):</label>
            <input type="text" id="antigravity-source-url" class="text_pole" placeholder="https://..." value="${settings.sourceUrl}" />
            <button id="antigravity-save-btn" class="menu_button">Guardar</button>
        </div>
    `;

    document.body.appendChild(container);

    // Listeners
    const btn = document.getElementById("antigravity-connect-btn");
    const popup = document.getElementById("antigravity-settings");
    const input = document.getElementById("antigravity-source-url");
    const saveBtn = document.getElementById("antigravity-save-btn");

    // Click primario: Conectar
    btn.addEventListener("click", () => {
        fetchAndConnect();
    });

    // Evitar que clicks dentro del popup se propaguen (y lo cierren si hay listeners globales)
    popup.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    // Click derecho: Configuración
    btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        popup.classList.toggle("hidden");
    });

    saveBtn.addEventListener("click", () => {
        settings.sourceUrl = input.value;
        saveSettings();
        popup.classList.add("hidden");
        toastr.success("Configuración guardada.", "Antigravity");
    });
}

// Inicialización
jQuery(async () => {
    console.log("🚀 [Antigravity] Intentando cargar extensión...");
    try {
        await loadSettings();
        createUi();
        console.log("✅ [Antigravity] UI Creada y Extensión Cargada");
        toastr.success("Antigravity Cargado", "Sistema");
    } catch (e) {
        console.error("❌ [Antigravity] Error Fatal al inciar:", e);
        toastr.error("Error al iniciar Antigravity", "Extensiones");
    }
});

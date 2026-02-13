import {
    extension_settings,
    getContext,
} from "../../../extensions.js";
// Toastr is global in SillyTavern

const extensionName = "antigravity";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// Configuración por defecto
const defaultSettings = {
    sourceUrl: "https://api.npoint.io/d591176bd0f49d59dbba", // URL del JSON o Endpoint
};

let settings = defaultSettings;

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
    const icon = connectBtn.querySelector("i");

    // Indicador de carga
    icon.classList.remove("fa-link");
    icon.classList.add("fa-spinner", "fa-spin");

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

        toastr.success(`URL encontrada: ${newUrl}`, "Antigravity");

        // ACTUALIZAR SILLYTAVERN
        // Accedemos al contexto global de ST
        const context = getContext();

        // Actualizamos URL de API principal (TextGeneration)
        // Nota: Esto depende de cómo ST maneja la API actualmente seleccionada.
        // Asumimos que el usuario ya tiene seleccionado "KoboldCPP" o "Text Completion".

        // Soporte para IDs actuales y legacy de ST
        const inputIds = [
            "koboldcpp_api_url_text", // ST actual para KoboldCpp
            "api_url_text", // Kobold legacy
            "api_url_textgeneration", // TextGen legacy
        ];
        const buttonIds = [
            "api_button_textgenerationwebui", // ST actual
            "api_button", // Kobold legacy
            "api_button_textgeneration", // TextGen legacy
        ];

        let updatedInputs = 0;
        for (const inputId of inputIds) {
            const input = document.getElementById(inputId);
            if (!input) continue;
            input.value = newUrl;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            updatedInputs++;
        }

        const connectApiBtn = buttonIds
            .map((id) => document.getElementById(id))
            .find(Boolean);

        if (updatedInputs === 0) {
            toastr.error("No se encontró ningún campo de URL API. Abre la sección de conexión del backend.", "Antigravity");
        } else if (connectApiBtn) {
            setTimeout(() => connectApiBtn.click(), 500);
            toastr.success("Intentando reconectar...", "Antigravity");
        } else {
            toastr.warning("URL actualizada, pero no encontré el botón de conectar.", "Antigravity");
        }

    } catch (err) {
        console.error(err);
        toastr.error(`Error: ${err.message}`, "Antigravity Falló");
    } finally {
        icon.classList.remove("fa-spinner", "fa-spin");
        icon.classList.add("fa-link");
    }
}

function createUi() {
    // 1. Botón en la Barra Superior (junto a otros iconos)
    // Buscamos el contenedor de iconos de la derecha (depende de la versión de ST, suele ser #extensions_menu o similar,
    // pero para estar seguros lo pondremos flotante o en el drawer de extensiones)

    // Método seguro: Añadir a la lista de extensiones o crear un botón flotante discreto.
    // Vamos a inyectarlo en el panel de conexiones API si es posible, o en el top bar.

    const topBar = document.getElementById("quick-reply-container") || document.querySelector(".nav-bottom-right"); // Intentar ubicarlo abajo a la derecha o arriba
    // Mejor: Un botón en el header principal
    const headerIcons = document.querySelector(".drawer-content .flex-container") || document.body;

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

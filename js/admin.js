
const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("login-button");
const loginMessage = document.getElementById("login-message");

const loginContainer = document.querySelector(".login-container");
const dashboard = document.getElementById("admin-dashboard");
const ordersContainer = document.getElementById("orders-container");

const refreshButton = document.getElementById("refresh-button");
const logoutButton = document.getElementById("logout-button");

// Control de actualización automática
let ordersRefreshInterval = null;
let isLoadingOrders = false;

// Estados permitidos para los pedidos
const orderStatuses = [
    "pendiente",
    "preparando",
    "listo",
    "entregado",
    "cancelado"
];

// Formatear importes
function formatPrice(price) {
    return Number(price).toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0
    });
}

// Evitar que los datos del cliente se interpreten como HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

// Comprobar si el usuario es administrador
async function verifyAdmin() {
    const { data, error } = await supabaseClient.rpc("is_admin");

    if (error) {
        throw error;
    }

    return data === true;
}

// Mostrar el panel
function showDashboard() {
    loginContainer.style.display = "none";
    dashboard.hidden = false;

    // Cargar pedidos inmediatamente
    loadOrders();

    // Evitar crear varios intervalos
    if (ordersRefreshInterval !== null) {
        clearInterval(ordersRefreshInterval);
    }

    // Actualizar pedidos cada 5 segundos
    ordersRefreshInterval = setInterval(() => {
        if (!document.hidden) {
            loadOrders();
        }
    }, 5000);
}

// Iniciar sesión
loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginButton.disabled = true;
    loginButton.textContent = "Verificando...";
    loginMessage.textContent = "";

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        const isAdmin = await verifyAdmin();

        if (!isAdmin) {
            await supabaseClient.auth.signOut();
            throw new Error("Tu cuenta no tiene permisos de administrador.");
        }

        loginMessage.style.color = "#4ade80";
        loginMessage.textContent = "Acceso autorizado.";

        showDashboard();

    } catch (error) {
        console.error("Error de inicio de sesión:", error);

        loginMessage.style.color = "#ff5555";
        loginMessage.textContent = error.message ||
            "No se pudo iniciar sesión.";

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Iniciar sesión";
    }
});

// Cargar pedidos desde Supabase
async function loadOrders() {
        if (isLoadingOrders) return;

    isLoadingOrders = true;
    ordersContainer.innerHTML = "<p>Cargando pedidos...</p>";

    try {
        const { data: orders, error } = await supabaseClient
            .from("orders")
            .select("id, order_number, customer_name, total, status, created_at")
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!orders || orders.length === 0) {
            ordersContainer.innerHTML = "<p>Todavía no hay pedidos registrados.</p>";
            return;
        }

        let html = "";

        for (const order of orders) {
            const { data: items, error: itemsError } = await supabaseClient
                .from("order_items")
                .select("product_name, quantity, unit_price, subtotal")
                .eq("order_id", order.id);

            if (itemsError) throw itemsError;

            const date = new Date(order.created_at).toLocaleString("es-AR");

            const itemsHTML = (items || []).map(item => `
                <div class="order-item">
                    <span>${escapeHTML(item.product_name)} x ${item.quantity}</span>
                    <span>${formatPrice(item.subtotal)}</span>
                </div>
            `).join("");

            const optionsHTML = orderStatuses.map(status => `
                <option value="${status}" ${order.status === status ? "selected" : ""}>
                    ${status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
            `).join("");

            html += `
                <article class="order-card">
                    <div class="order-card-header">
                        <h3>Pedido #${escapeHTML(order.order_number)}</h3>
                        <span class="order-status status-${escapeHTML(order.status)}">
                        ${escapeHTML(order.status)}
                        </span>
                    </div>

                    <p><strong>Cliente:</strong> ${escapeHTML(order.customer_name)}</p>
                    <p><strong>Fecha:</strong> ${escapeHTML(date)}</p>

                    <div class="order-items">
                        <h4>Productos</h4>
                        ${itemsHTML}
                    </div>

                    <p class="order-total">
                        Total: ${formatPrice(order.total)}
                    </p>

                    <label for="status-${escapeHTML(order.id)}">
                        Estado del pedido:
                    </label>

                    <select
                        class="status-select"
                        id="status-${escapeHTML(order.id)}"
                        data-order-id="${escapeHTML(order.id)}"
                    >
                        ${optionsHTML}
                    </select>
                </article>
            `;
        }

        ordersContainer.innerHTML = html;

    } catch (error) {
        console.error("Error al cargar pedidos:", error);
        ordersContainer.innerHTML =
            "<p>No se pudieron cargar los pedidos. Revisá la conexión e intentá actualizar.</p>";
    } finally {
        isLoadingOrders = false;
    }
}

// Actualizar el estado de un pedido
ordersContainer.addEventListener("change", async function(event) {
    if (!event.target.classList.contains("status-select")) return;

    const orderId = event.target.dataset.orderId;
    const newStatus = event.target.value;

    event.target.disabled = true;

    try {
        const { error } = await supabaseClient
            .from("orders")
            .update({ status: newStatus })
            .eq("id", orderId);

        if (error) throw error;

        alert("El estado del pedido se actualizó correctamente.");
        await loadOrders();

    } catch (error) {
        console.error("Error al actualizar el pedido:", error);
        alert("No se pudo actualizar el estado del pedido.");
        await loadOrders();

    } finally {
        event.target.disabled = false;
    }
});

// Actualizar pedidos manualmente
refreshButton.addEventListener("click", loadOrders);

// Cerrar sesión
logoutButton.addEventListener("click", async function() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert("No se pudo cerrar la sesión.");
        console.error(error);
        return;
    }

    dashboard.hidden = true;
    loginContainer.style.display = "";
    loginForm.reset();
    loginMessage.textContent = "";
});

// Comprobar si ya existe una sesión al abrir la página
async function checkExistingSession() {
    try {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        if (data.session) {
            const isAdmin = await verifyAdmin();

            if (isAdmin) {
                showDashboard();
            } else {
                await supabaseClient.auth.signOut();
            }
        }

    } catch (error) {
        console.error("Error al comprobar la sesión:", error);
    }
}

checkExistingSession();

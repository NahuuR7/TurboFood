
// ======================================
// TURBO FOOD - MENÚ CON SUPABASE
// ======================================

let products = [];
let cart = [];

// Elementos HTML

const productsContainer = document.getElementById("products-container");
const cartContainer = document.getElementById("cart-container");
const cartCount = document.getElementById("cart-count");
const cartTotal = document.getElementById("cart-total");
const checkoutButton = document.getElementById("checkout-button");

// ======================================
// FORMATEAR PRECIOS
// ======================================

function formatPrice(price) {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0
    }).format(price);
}

// ======================================
// OBTENER PRODUCTOS DE SUPABASE
// ======================================

async function loadProducts() {

    console.log("1. Iniciando carga de productos...");

    productsContainer.innerHTML = "<p>Cargando menú...</p>";

    try {

        console.log("2. Cliente Supabase:", supabaseClient);

        const { data, error } = await Promise.race([

            supabaseClient
                .from("products")
                .select("id, name, description, price, category, image_emoji, is_available")
                .eq("is_available", true)
                .order("id"),

            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("La consulta tardó demasiado")), 10000)
            )

        ]);

        console.log("3. Respuesta de Supabase:", data);

        if (error) {
            throw error;
        }

        products = data.map(product => ({
            ...product,
            image: product.image_emoji || "🍔"
        }));

        console.log("4. Productos cargados:", products.length);

        renderProducts();

    } catch (error) {

        console.error("ERROR AL CARGAR EL MENÚ:", error);

        productsContainer.innerHTML =
            "<p>No se pudo cargar el menú. Revisá la consola.</p>";
    }
}

// ======================================
// MOSTRAR PRODUCTOS
// ======================================

function renderProducts(category = "Todos") {

    const filteredProducts = category === "Todos"
        ? products
        : products.filter(product => product.category === category);

    productsContainer.innerHTML = filteredProducts.map(product => `
        <article class="product-card">

            <div class="product-image">
                ${product.image}
            </div>

            <div class="product-info">

                <h3>${product.name}</h3>

                <p>${product.description || ""}</p>

                <div class="product-bottom">

                    <span class="product-price">
                        ${formatPrice(product.price)}
                    </span>

                    <button
                        class="add-button"
                        data-id="${product.id}">
                        + Agregar
                    </button>

                </div>

            </div>

        </article>
    `).join("");

}

// ======================================
// AGREGAR PRODUCTOS AL CARRITO
// ======================================

productsContainer.addEventListener("click", function(event) {

    const button = event.target.closest(".add-button");

    if (!button) return;

    const productId = Number(button.dataset.id);

    const product = products.find(p => p.id === productId);

    if (!product) return;

    const existingProduct = cart.find(p => p.id === productId);

    if (existingProduct) {
        existingProduct.quantity++;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }

    renderCart();

});

// ======================================
// MOSTRAR CARRITO
// ======================================

function renderCart() {

    if (cart.length === 0) {

        cartContainer.innerHTML = `
            <p class="empty-cart">
                Todavía no agregaste productos.
            </p>
        `;

    } else {

        cartContainer.innerHTML = cart.map(product => `
            <div class="cart-item">

                <div>
                    <strong>${product.name}</strong>

                    <small>
                        ${formatPrice(product.price)} c/u
                    </small>
                </div>

                <div class="quantity-controls">

                    <button
                        data-action="decrease"
                        data-id="${product.id}">
                        -
                    </button>

                    <span>${product.quantity}</span>

                    <button
                        data-action="increase"
                        data-id="${product.id}">
                        +
                    </button>

                </div>

            </div>
        `).join("");

    }

    const totalProducts = cart.reduce(
        (total, product) => total + product.quantity,
        0
    );

    const totalPrice = cart.reduce(
        (total, product) => total + product.price * product.quantity,
        0
    );

    cartCount.textContent = `${totalProducts} productos`;

    cartTotal.textContent = formatPrice(totalPrice);

    checkoutButton.disabled = cart.length === 0;

}

// ======================================
// MODIFICAR CANTIDADES
// ======================================

cartContainer.addEventListener("click", function(event) {

    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const productId = Number(button.dataset.id);

    const product = cart.find(p => p.id === productId);

    if (!product) return;

    if (button.dataset.action === "increase") {
        product.quantity++;
    }

    if (button.dataset.action === "decrease") {

        product.quantity--;

        if (product.quantity <= 0) {
            cart = cart.filter(p => p.id !== productId);
        }

    }

    renderCart();

});

// ======================================
// FILTRAR CATEGORÍAS
// ======================================

document.querySelectorAll(".category").forEach(button => {

    button.addEventListener("click", function() {

        document.querySelectorAll(".category").forEach(btn => {
            btn.classList.remove("active");
        });

        this.classList.add("active");

        renderProducts(this.dataset.category);

    });

});

// ======================================
// INICIAR APLICACIÓN
// ======================================

renderCart();
loadProducts();


// ======================================
// CONFIRMAR PEDIDO EN SUPABASE
// ======================================

checkoutButton.addEventListener("click", async function() {

    if (cart.length === 0) {
        alert("Tu carrito está vacío.");
        return;
    }

    const customerName = document
        .getElementById("customer-name")
        .value.trim();

    if (customerName.length < 2) {
        alert("Ingresá un nombre válido para tu pedido.");
        return;
    }

    const confirmation = confirm(
        `¿Confirmás tu pedido, ${customerName}?`
    );

    if (!confirmation) return;

    checkoutButton.disabled = true;
    checkoutButton.textContent = "Enviando pedido...";

    try {

        const items = cart.map(product => ({
            product_id: product.id,
            quantity: product.quantity
        }));

        const { data, error } = await supabaseClient.rpc(
            "create_order",
            {
                p_customer_name: customerName,
                p_items: items
            }
        );

        if (error) {
            throw error;
        }

        alert(
            `¡PEDIDO CONFIRMADO!\n\n` +
            `Número de pedido: ${data.order_number}\n` +
            `Nombre: ${customerName}\n` +
            `Total: $${Number(data.total).toLocaleString("es-AR")}\n\n` +
            `Podés abonar al retirar tu pedido.`
        );

        cart = [];
        renderCart();

        document.getElementById("customer-name").value = "";

    } catch (error) {

        console.error("Error al confirmar pedido:", error);

        alert(
            "No pudimos registrar tu pedido. " +
            "Intentá nuevamente."
        );

    } finally {

        checkoutButton.disabled = false;
        checkoutButton.textContent = "Confirmar pedido";

    }

});

// ======================================
// BOTON DE CANCELAR PEDIDO
// ======================================

function cancelOrder() {

    if (cart.length === 0) {
        alert("El carrito ya está vacío.");
        return;
    }

    const confirmation = confirm(
        "¿Estás seguro de que querés cancelar el pedido?"
    );

    if (confirmation) {
        cart = [];
        renderCart();

        alert("Pedido cancelado correctamente.");
    }
}
document
    .getElementById("cancel-order-button")
    .addEventListener("click", cancelOrder);

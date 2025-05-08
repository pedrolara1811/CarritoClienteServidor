// Definir serverIP como variable global al inicio del archivo
const serverIP = "http://localhost:5000";

document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticación
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }

    // Mostrar usuario
    document.getElementById('user-greeting').textContent = `Hola, ${user.name}`;

        // Verificar si el usuario tiene una dirección guardada
    fetch(`${serverIP}/address/user/${user.id}`)
        .then(response => response.json())
        .then(data => {
            if (!data.has_address) {
                alert('Necesitas agregar una dirección de envío antes de proceder al pago.');
                window.location.href = 'address.html';
                return;
            }
            // Si tiene dirección, continuar con la carga normal del carrito
            cargarDatosCarrito(carritoId);
        })
        .catch(error => {
            console.error('Error al verificar la dirección:', error);
            alert('Error al verificar tu información de envío. Por favor intenta nuevamente.');
            window.location.href = 'index.html';
        });

    // Obtener ID del carrito
    const carritoId = localStorage.getItem('carritoId');
    if (!carritoId) {
        alert('No se encontró un carrito activo');
        window.location.href = 'index.html';
        return;
    }

    // Cargar datos del carrito
    cargarDatosCarrito(carritoId);

        // Cargar información de dirección del usuario
    fetch(`${serverIP}/address/user/${user.id}`)
        .then(response => response.json())
        .then(data => {
            if (data.has_address) {
                const addressDetails = document.getElementById('shipping-address-details');
                addressDetails.innerHTML = `
                    ${data.address.street} ${data.address.number}<br>
                    ${data.address.city}, ${data.address.state} ${data.address.zip_code}<br>
                    ${data.address.country}
                `;
            }
        })

    .catch(error => console.error('Error al cargar dirección:', error));
    // Event listeners para botones
    document.getElementById('back-to-cart').addEventListener('click', function() {
        window.location.href = 'index.html';
    });

    document.getElementById('logout-btn').addEventListener('click', function() {
        localStorage.removeItem('user');
        localStorage.removeItem('carritoId');
        window.location.href = 'auth.html';
    });

    document.getElementById('cancel-payment').addEventListener('click', function() {
        window.location.href = 'index.html';
    });

    document.getElementById('continue-shopping').addEventListener('click', function() {
        window.location.href = 'index.html';
    });

    // Manejar envío del formulario de pago
    document.getElementById('payment-form').addEventListener('submit', function(e) {
        e.preventDefault();
        procesarPago(carritoId);
    });
});

function cargarDatosCarrito(carritoId) {
    fetch(`${serverIP}/carrito/${carritoId}`)
        .then(response => response.json())
        .then(carrito => {
            if (carrito.error) {
                alert('Error al cargar el carrito');
                window.location.href = 'index.html';
                return;
            }

            // Mostrar los items del carrito
            const itemsList = document.getElementById('payment-items-list');
            const totalElement = document.getElementById('payment-total');

            itemsList.innerHTML = '';

            if (carrito.items.length === 0) {
                itemsList.innerHTML = '<p>No hay productos en tu carrito</p>';
                totalElement.textContent = '0.00';
                document.getElementById('confirm-payment').disabled = true;
                return;
            }

            let total = 0;
            carrito.items.forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.className = 'payment-item';
                itemElement.innerHTML = `
                    <div>
                        <strong>${item.nombre}</strong> 
                        <span>($${item.precio.toFixed(2)} x ${item.cantidad})</span>
                    </div>
                    <div>$${(item.precio * item.cantidad).toFixed(2)}</div>
                `;
                itemsList.appendChild(itemElement);
                total += item.precio * item.cantidad;
            });

            totalElement.textContent = total.toFixed(2);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error al cargar los datos del carrito');
        });
}

function procesarPago(carritoId) {
    const user = JSON.parse(localStorage.getItem('user'));

    // Recopilar datos de la tarjeta
    const cardHolder = document.getElementById('card-holder').value;
    const cardNumber = document.getElementById('card-number').value.replace(/\s/g, '');
    const expiryDate = document.getElementById('expiry-date').value;
    const cvv = document.getElementById('cvv').value;

    // Aquí normalmente validarías los datos de la tarjeta,
    // pero como mencionaste que no se necesita verificación real,
    // procedemos directamente al proceso de pago

    // Mostrar indicador de carga
    const confirmButton = document.getElementById('confirm-payment');
    const originalButtonText = confirmButton.textContent;
    confirmButton.disabled = true;
    confirmButton.textContent = 'Procesando...';

    // Enviar datos al servidor para procesar el pago
    fetch(`${serverIP}/procesar-pago`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: user.id,
            carrito_id: carritoId,
            payment_info: {
                card_holder: cardHolder,
                card_number: maskCardNumber(cardNumber),
                expiry_date: expiryDate
                // No enviamos el CVV por seguridad
            }
        })
    })
    .then(response => response.json())
    .then(data => {
        // Restaurar el botón
        confirmButton.disabled = false;
        confirmButton.textContent = originalButtonText;

        if (data.error) {
            // Manejar error específico de stock insuficiente
            if (data.items_sin_stock) {
                let errorMessage = 'No hay suficiente stock para los siguientes productos:\n\n';
                data.items_sin_stock.forEach(item => {
                    errorMessage += `${item.nombre} - Disponible: ${item.stock_disponible}, Solicitado: ${item.cantidad_solicitada}\n`;
                });
                errorMessage += '\nPor favor, ajusta las cantidades en tu carrito.';
                alert(errorMessage);

                // Redirigir al carrito para ajustar cantidades
                window.location.href = 'index.html';
                return;
            } else {
                // Otros errores
                alert(`Error: ${data.error}`);
                return;
            }
        }

        // Mostrar comprobante de pago
        document.getElementById('invoice-number').textContent = data.payment_id;

        // Generar detalles del comprobante
        const invoiceDetails = document.getElementById('invoice-details');
        invoiceDetails.innerHTML = `
            <p><strong>Fecha:</strong> ${data.date}</p>
            <p><strong>Cliente:</strong> ${cardHolder}</p>
            
            <div class="invoice-address">
                <h4>Dirección de Envío:</h4>
                ${data.address ? `
                    ${data.address.street} ${data.address.number}<br>
                    ${data.address.city}, ${data.address.state} ${data.address.zip_code}<br>
                    ${data.address.country}
                ` : 'No se especificó dirección'}
            </div>
            
            <h3>Productos:</h3>
            <ul>
                ${data.items.map(item => `
                    <li>
                        ${item.nombre} - $${item.precio.toFixed(2)} x ${item.cantidad} = $${(item.precio * item.cantidad).toFixed(2)}
                        <br><small>Proveedor: ${item.provider || 'No especificado'}</small>
                    </li>
                `).join('')}
            </ul>
            <p><strong>Total:</strong> $${data.total.toFixed(2)}</p>
        `;

        // Mostrar panel de éxito
        document.getElementById('payment-success').style.display = 'block';

        // Ocultar formulario de pago
        document.querySelector('.credit-card-form').style.display = 'none';
        document.querySelector('.payment-summary').style.display = 'none';
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error al procesar el pago. Por favor intenta nuevamente.');

        // Restaurar el botón
        confirmButton.disabled = false;
        confirmButton.textContent = originalButtonText;
    });
}

function maskCardNumber(cardNumber) {
    // Mostrar solo los últimos 4 dígitos
    return 'xxxx-xxxx-xxxx-' + cardNumber.slice(-4);
}

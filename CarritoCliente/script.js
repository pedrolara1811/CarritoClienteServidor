document.addEventListener('DOMContentLoaded', function() {
    const listaProductos = document.getElementById('lista-productos');
    const listaCarrito = document.getElementById('lista-carrito');
    const totalCarrito = document.getElementById('total-carrito');
    const crearCarritoBtn = document.getElementById('crear-carrito');
    const carritoIdElement = document.getElementById('carrito-id');
    const serverIP = "http://localhost:5000";

    let carritoId = localStorage.getItem('carritoId');
    let carritoActual = null;
    let productosDisponibles = [];

    // Verificar autenticación primero
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }

    // Mostrar usuario
    document.getElementById('user-greeting').textContent = `Hola, ${user.name}`;

    // Cargar productos
    fetch(`${serverIP}/productos`)
        .then(response => response.json())
        .then(productos => {
            productosDisponibles = productos;
            renderizarProductos();
        });

    // Modificar el botón para reflejar que estamos trabajando con carritos de usuario
    crearCarritoBtn.textContent = "Vaciar Carrito";
    crearCarritoBtn.addEventListener('click', vaciarCarrito);

    // Si hay un carrito en localStorage, cargarlo
    if (carritoId) {
        cargarCarrito(carritoId);
    } else {
        // Si por alguna razón no tenemos carrito pero sí usuario, intentamos recuperar su carrito
        obtenerCarritoPorUsuario(user.id);
    }

    function obtenerCarritoPorUsuario(userId) {
        fetch(`${serverIP}/carrito/usuario/${userId}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error:', data.error);
                    return;
                }

                carritoId = data._id;
                localStorage.setItem('carritoId', carritoId);
                carritoActual = data;
                carritoIdElement.textContent = carritoId;
                renderizarCarrito();
                actualizarBotonesAgregar();
            })
            .catch(error => {
                console.error('Error obteniendo carrito del usuario:', error);
            });
    }

    function renderizarProductos() {
        listaProductos.innerHTML = '';
        productosDisponibles.forEach(producto => {
            const productoElement = document.createElement('div');
            productoElement.className = 'producto';
            productoElement.innerHTML = `
                <h3>${producto.nombre}</h3>
                <p>$${producto.precio.toFixed(2)}</p>
                <p>${producto.descripcion}</p>
                <p>${"Kg en stock: "+producto.stock}</p>
                <img src="${producto.imagen}" alt="${producto.nombre}" 
                     class="producto-imagen" 
                     width="250" height="250"
                     style="object-fit: contain;">
                <div class="producto-controls">
                    <input type="number" class="cantidad-input" value="1" min="1" max="10" onkeydown="return event.keyCode !== 69 && event.keyCode !== 189 && event.keyCode !== 109" oninput="if(this.value < 1) this.value = 1; if(this.value > 10) this.value = 10;">
                    <button class="btn agregar-carrito" data-id="${producto._id}" data-stock="${producto.stock}">Agregar al Carrito</button>
                </div>
            `;
            listaProductos.appendChild(productoElement);
        });

        // Actualizar estado de los botones
        actualizarBotonesAgregar();

        // Event listeners para botones "Agregar al Carrito"
        document.querySelectorAll('.agregar-carrito').forEach(btn => {
            btn.addEventListener('click', function() {
                if (!carritoId) {
                    alert('Error: No se pudo cargar tu carrito');
                    return;
                }
                const productoId = this.getAttribute('data-id');
                const cantidad = parseInt(this.parentElement.querySelector('.cantidad-input').value);
                agregarAlCarrito(productoId, cantidad);
            });
        });
    }

    function actualizarBotonesAgregar() {
        // Si no tenemos carrito cargado, no podemos determinar qué productos están en él
        if (!carritoActual) return;

        document.querySelectorAll('.agregar-carrito').forEach(btn => {
            const productoId = btn.getAttribute('data-id');
            const stock = parseInt(btn.getAttribute('data-stock'));
            const estaEnCarrito = carritoActual.items.some(item => item.producto_id === productoId);

            // Verificar si el producto está en el carrito o no tiene stock
            if (estaEnCarrito || stock === 0) {
                btn.disabled = true;
                btn.classList.add('btn-disabled');

                // Opcionalmente, cambiar el texto del botón si no hay stock
                if (stock === 0) {
                    btn.textContent = "Sin Stock";
                }
            } else {
                btn.disabled = false;
                btn.classList.remove('btn-disabled');
                btn.textContent = "Agregar al Carrito";
            }
        });
    }

    function vaciarCarrito() {
        if (!carritoId || !carritoActual) {
            alert('No hay carrito activo que vaciar');
            return;
        }

        // Vaciar el carrito eliminando los productos uno por uno
        const promises = [];
        for (let i = carritoActual.items.length - 1; i >= 0; i--) {
            promises.push(
                fetch(`${serverIP}/carrito/${carritoId}/eliminar/${i}`, {
                    method: 'DELETE'
                }).then(res => res.json())
            );
        }

        Promise.all(promises)
            .then(() => {
                cargarCarrito(carritoId);
                alert('Carrito vaciado con éxito');
            })
            .catch(error => {
                console.error('Error al vaciar carrito:', error);
                alert('Error al vaciar el carrito');
            });
    }

    function cargarCarrito(id) {
        fetch(`${serverIP}/carrito/${id}`)
            .then(response => response.json())
            .then(carrito => {
                carritoActual = carrito;
                carritoIdElement.textContent = carrito._id;
                renderizarCarrito();
                actualizarBotonesAgregar();
            })
            .catch(error => {
                console.error('Error cargando carrito:', error);
                localStorage.removeItem('carritoId');
                carritoId = null;
                carritoActual = null;

                // Intentar obtener el carrito por usuario si falla la carga por ID
                const user = JSON.parse(localStorage.getItem('user'));
                if (user) {
                    obtenerCarritoPorUsuario(user.id);
                }
            });
    }

    function renderizarCarrito() {
        listaCarrito.innerHTML = '';

        if (!carritoActual || carritoActual.items.length === 0) {
            listaCarrito.innerHTML = '<p class="empty-cart-message">Tu carrito está vacío</p>';
            totalCarrito.textContent = '0.00';
            return;
        }

        carritoActual.items.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'item-carrito';
            itemElement.innerHTML = `
                <span>${item.nombre} - $${item.precio.toFixed(2)}</span>
                <div class="item-controls">
                    <input type="number" class="cantidad-input" value="${item.cantidad}" min="1" max="10" 
                           data-index="${index}" data-price="${item.precio}"
                           onkeydown="return event.keyCode !== 69 && event.keyCode !== 189 && event.keyCode !== 109" 
                           oninput="if(this.value < 1) this.value = 1; if(this.value > 10) this.value = 10;">
                    <button class="btn btn-danger eliminar-item" data-index="${index}">Eliminar</button>
                </div>
                <span class="item-subtotal">$${(item.precio * item.cantidad).toFixed(2)}</span>
            `;
            listaCarrito.appendChild(itemElement);
        });

        // Calcular y mostrar el total
        const total = carritoActual.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
        totalCarrito.textContent = total.toFixed(2);

        // Event listeners para botones "Eliminar"
        document.querySelectorAll('.eliminar-item').forEach(btn => {
            btn.addEventListener('click', function() {
                const itemIndex = this.getAttribute('data-index');
                eliminarDelCarrito(carritoId, itemIndex);
            });
        });

        // Event listeners para cambios en cantidad
        document.querySelectorAll('.item-carrito .cantidad-input').forEach(input => {
            input.addEventListener('change', function() {
                const newQuantity = parseInt(this.value);
                const itemIndex = this.getAttribute('data-index');
                const itemPrice = parseFloat(this.getAttribute('data-price'));

                if (newQuantity > 0 && newQuantity <= 10) {
                    // Actualizar visualmente el subtotal inmediatamente
                    const subtotalElement = this.closest('.item-carrito').querySelector('.item-subtotal');
                    subtotalElement.textContent = `$${(itemPrice * newQuantity).toFixed(2)}`;

                    // Actualizar cantidad y total
                    actualizarCantidadEnCarrito(carritoId, itemIndex, newQuantity, itemPrice);
                } else {
                    // Revertir al valor anterior si no es válido
                    this.value = carritoActual.items[itemIndex].cantidad;
                }
            });
        });
    }

    function agregarAlCarrito(productoId, cantidad) {
        fetch(`${serverIP}/carrito/${carritoId}/agregar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                producto_id: productoId,
                cantidad: cantidad
            })
        })
        .then(response => response.json())
        .then(() => {
            cargarCarrito(carritoId);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error al agregar producto al carrito');
        });
    }

    function actualizarCantidadEnCarrito(carritoId, itemIndex, newQuantity, itemPrice) {
        const oldQuantity = carritoActual.items[itemIndex].cantidad;
        const quantityDiff = newQuantity - oldQuantity;

        // Actualización visual inmediata
        carritoActual.items[itemIndex].cantidad = newQuantity;
        actualizarTotalCarrito();

        // Actualización en el servidor
        fetch(`${serverIP}/carrito/${carritoId}/actualizar/${itemIndex}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nueva_cantidad: newQuantity,
                diferencia_precio: quantityDiff * itemPrice
            })
        })
        .then(response => {
            if (!response.ok) {
                // Si hay error, revertir los cambios visuales
                carritoActual.items[itemIndex].cantidad = oldQuantity;
                actualizarTotalCarrito();
                throw new Error('Error al actualizar cantidad');
            }
            return response.json();
        })
        .catch(error => {
            console.error('Error:', error);
            // Mostrar mensaje de error al usuario
            alert('No se pudo actualizar la cantidad. Por favor intenta nuevamente.');
        });
    }

    function actualizarTotalCarrito() {
        // Calcular el nuevo total basado en los items actuales
        const nuevoTotal = carritoActual.items.reduce((total, item) => {
            return total + (item.precio * item.cantidad);
        }, 0);

        // Actualizar el display del total
        totalCarrito.textContent = nuevoTotal.toFixed(2);
    }

    function eliminarDelCarrito(carritoId, itemIndex) {
        fetch(`${serverIP}/carrito/${carritoId}/eliminar/${itemIndex}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(() => {
            cargarCarrito(carritoId);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error al eliminar producto del carrito');
        });
    }

    // Checkout button
    document.getElementById('checkout-btn').addEventListener('click', function() {
        if (!carritoActual || carritoActual.items.length === 0) {
            alert('No puedes proceder al pago con un carrito vacío');
            return;
        }
        window.location.href = 'payment.html';
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', function() {
        localStorage.removeItem('user');
        localStorage.removeItem('carritoId');
        window.location.href = 'auth.html';
    });
    document.getElementById('address-btn').addEventListener('click', function() {
        window.location.href = 'address.html';
    });
});

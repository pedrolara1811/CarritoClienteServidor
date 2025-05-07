document.addEventListener('DOMContentLoaded', function() {
    const serverIP = "http://localhost:5000";
    // Manejo de pestañas
    const tabs = document.querySelectorAll('.auth-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('.auth-form').forEach(form => {
                form.classList.add('hidden');
            });

            document.getElementById(`${this.dataset.tab}-form`).classList.remove('hidden');
        });
    });

    // Login
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        fetch(`${serverIP}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            localStorage.setItem('user', JSON.stringify({
                id: data.user_id,
                name: data.name,
                email: email
            }));

            // Guardar el carrito_id asociado al usuario
            localStorage.setItem('carritoId', data.carrito_id);

            alert(`Bienvenido ${data.name}`);
            window.location.href = 'index.html';
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error al iniciar sesión');
        });
    });

    // Signup
    document.getElementById('signupForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        fetch(`${serverIP}/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            alert('Registro exitoso! Por favor inicia sesión');
            document.querySelector('.auth-tab[data-tab="login"]').click();
            document.getElementById('login-email').value = email;
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error al registrarse');
        });
    });
});

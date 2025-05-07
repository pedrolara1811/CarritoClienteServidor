document.addEventListener('DOMContentLoaded', function() {
     const serverIP = "http://localhost:5000";
     // Verificar autenticación
     const user = JSON.parse(localStorage.getItem('user'));
     if (!user) {
         window.location.href = 'auth.html';
         return;
     }
 
     // Mostrar usuario
     document.getElementById('user-greeting').textContent = `Hola, ${user.name}`;
 
     // Event listeners para botones de navegación
     document.getElementById('back-to-cart').addEventListener('click', function() {
         window.location.href = 'index.html';
     });
 
     document.getElementById('logout-btn').addEventListener('click', function() {
         localStorage.removeItem('user');
         localStorage.removeItem('carritoId');
         window.location.href = 'auth.html';
     });
 
     // Verificar si el usuario ya tiene una dirección guardada
     checkUserAddress(user.id);
 
     // Event listener para editar dirección existente
     document.getElementById('edit-address-btn').addEventListener('click', function() {
         document.getElementById('saved-address-container').style.display = 'none';
         document.getElementById('address-form-container').style.display = 'block';
     });
 
     // Event listener para cancelar formulario
     document.getElementById('cancel-address').addEventListener('click', function() {
         checkUserAddress(user.id); // Volver a verificar la dirección del usuario
     });
 
     // Event listener para guardar dirección
     document.getElementById('address-form').addEventListener('submit', function(e) {
         e.preventDefault();
 
         const addressData = {
             user_id: user.id,
             street: document.getElementById('street').value,
             number: document.getElementById('number').value,
             city: document.getElementById('city').value,
             state: document.getElementById('state').value,
             zip_code: document.getElementById('zip_code').value,
             country: document.getElementById('country').value
         };
 
         saveUserAddress(addressData);
     });
 });
 
 function checkUserAddress(userId) {
     const serverIP = `${serverIP}`;
     fetch(`${serverIP}/address/user/${userId}`)
         .then(response => response.json())
         .then(data => {
             if (data.has_address) {
                 // Mostrar la dirección guardada
                 document.getElementById('saved-address-text').innerHTML = `
                     ${data.address.street} ${data.address.number}<br>
                     ${data.address.city}, ${data.address.state} ${data.address.zip_code}<br>
                     ${data.address.country}
                 `;
                 document.getElementById('saved-address-container').style.display = 'block';
                 document.getElementById('address-form-container').style.display = 'none';
 
                 // Pre-llenar el formulario por si el usuario quiere editar
                 document.getElementById('street').value = data.address.street;
                 document.getElementById('number').value = data.address.number;
                 document.getElementById('city').value = data.address.city;
                 document.getElementById('state').value = data.address.state;
                 document.getElementById('zip_code').value = data.address.zip_code;
                 document.getElementById('country').value = data.address.country;
             } else {
                 // Mostrar formulario para agregar dirección
                 document.getElementById('saved-address-container').style.display = 'none';
                 document.getElementById('address-form-container').style.display = 'block';
             }
         })
         .catch(error => {
             console.error('Error al verificar la dirección:', error);
             document.getElementById('saved-address-container').style.display = 'none';
             document.getElementById('address-form-container').style.display = 'block';
         });
 }
 
 function saveUserAddress(addressData) {
     const serverIP = `${serverIP}`;
     const saveButton = document.getElementById('save-address');
     const originalText = saveButton.textContent;
     saveButton.disabled = true;
     saveButton.textContent = 'Guardando...';
 
     fetch(`${serverIP}/address`, {
         method: 'POST',
         headers: {
             'Content-Type': 'application/json'
         },
         body: JSON.stringify(addressData)
     })
     .then(response => response.json())
     .then(data => {
         saveButton.disabled = false;
         saveButton.textContent = originalText;
 
         if (data.error) {
             alert(`Error: ${data.error}`);
             return;
         }
 
         alert('Dirección guardada con éxito');
         checkUserAddress(addressData.user_id); // Actualizar vista
     })
     .catch(error => {
         console.error('Error:', error);
         alert('Error al guardar la dirección');
         saveButton.disabled = false;
         saveButton.textContent = originalText;
     });
 }

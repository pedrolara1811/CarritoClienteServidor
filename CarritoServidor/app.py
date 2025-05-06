from flask import Flask, request, jsonify
from flask_pymongo import PyMongo
from flask_cors import CORS
from bson.objectid import ObjectId
from flask_bcrypt import Bcrypt
import dotenv
import os
from pymongo import MongoClient
from datetime import datetime
import uuid

app = Flask(__name__)
bcrypt = Bcrypt(app)
CORS(app)  # Esto permite solicitudes cruzadas entre cliente y servidor

cluster = MongoClient(os.environ.get('MONGO_URI'))
db = cluster['shopping_cart']
# Colecciones
productos = db.products
carritos = db.carts
users = db.users
payments = db.payments  # Nueva colección para pagos
address = db.addresses


# Add this route to handle address management
@app.route('/address', methods=['POST'])
def add_address():
    data = request.json
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({'error': 'ID de usuario requerido'}), 400

    # Validate required fields
    required_fields = ['street', 'number', 'city', 'state', 'zip_code', 'country']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'Campo {field} requerido'}), 400

    # Create address document
    address = {
        'user_id': user_id,
        'street': data.get('street'),
        'number': data.get('number'),
        'city': data.get('city'),
        'state': data.get('state'),
        'zip_code': data.get('zip_code'),
        'country': data.get('country'),
        'created_at': datetime.now().strftime("%H-%M-%d-%m-%Y")
    }

    # Add to addresses collection
    address_id = db.addresses.insert_one(address).inserted_id

    # Update user with address reference
    users.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {'address_id': str(address_id)}}
    )

    return jsonify({
        'message': 'Dirección guardada con éxito',
        'address_id': str(address_id)
    }), 201


@app.route('/address/user/<user_id>', methods=['GET'])
def get_user_address(user_id):
    """Get address for a specific user"""
    user = users.find_one({'_id': ObjectId(user_id)})

    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    # If user has no address
    if 'address_id' not in user:
        return jsonify({'has_address': False}), 200

    # Get address from addresses collection
    address = db.addresses.find_one({'_id': ObjectId(user['address_id'])})

    if not address:
        return jsonify({'error': 'Dirección no encontrada'}), 404

    return jsonify({
        'has_address': True,
        'address': {
            'id': str(address['_id']),
            'street': address['street'],
            'number': address['number'],
            'city': address['city'],
            'state': address['state'],
            'zip_code': address['zip_code'],
            'country': address['country']
        }
    }), 200

# Ruta para registro
@app.route('/auth/signup', methods=['POST'])
def signup():
    data = request.json
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Datos incompletos'}), 400

    if users.find_one({'email': data['email']}):
        return jsonify({'error': 'El email ya está registrado'}), 400

    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')

    user = {
        'name': data.get('name', ''),
        'email': data['email'],
        'password': hashed_password,
        'created_at': datetime.now().strftime("%H-%M-%d-%m-%Y")
    }

    user_id = users.insert_one(user).inserted_id

    # Crear un carrito para el nuevo usuario
    carrito_id = carritos.insert_one({
        'user_id': str(user_id),
        'items': [],
        'total': 0,
        'created_at': datetime.now().strftime("%H-%M-%d-%m-%Y")
    }).inserted_id

    return jsonify({
        'message': 'Usuario registrado con éxito',
        'user_id': str(user_id),
        'carrito_id': str(carrito_id)
    }), 201


# Ruta para login
@app.route('/auth/login', methods=['POST'])
def login():
    data = request.json
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Datos incompletos'}), 400

    user = users.find_one({'email': data['email']})
    if not user or not bcrypt.check_password_hash(user['password'], data['password']):
        return jsonify({'error': 'Credenciales inválidas'}), 401

    # Buscar carrito del usuario
    user_id = str(user['_id'])
    carrito = carritos.find_one({'user_id': user_id})

    # Si no existe carrito para este usuario, crear uno nuevo
    if not carrito:
        carrito_id = carritos.insert_one({
            'user_id': user_id,
            'items': [],
            'total': 0,
            'created_at': datetime.now().strftime("%H-%M-%d-%m-%Y")
        }).inserted_id
        carrito_id = str(carrito_id)
    else:
        carrito_id = str(carrito['_id'])

    return jsonify({
        'message': 'Login exitoso',
        'user_id': user_id,
        'name': user['name'],
        'carrito_id': carrito_id
    }), 200


# Rutas para Productos
@app.route('/productos', methods=['GET'])
def obtener_productos():
    productos_list = []
    for producto in productos.find():
        productos_list.append({
            '_id': str(producto['_id']),
            'nombre': producto['name'],
            'precio': producto['price'],
            'descripcion': producto.get('description', ''),
            'stock': producto['stock'],
            'imagen': producto.get('image_route', '')
        })
    return jsonify(productos_list)


@app.route('/productos', methods=['POST'])
def agregar_producto():
    nuevo_producto = {
        'nombre': request.json['name'],
        'precio': request.json['price'],
        'descripcion': request.json.get('description', ''),
        'imagen': request.json.get('image_route', '')
    }
    producto_id = productos.insert_one(nuevo_producto).inserted_id
    return jsonify({'id': str(producto_id)}), 201


# Rutas para Carrito - Ya no necesitamos crear carrito directamente
# ahora se crea automáticamente al registrar o iniciar sesión
@app.route('/carrito/usuario/<user_id>', methods=['GET'])
def obtener_carrito_usuario(user_id):
    """Obtener carrito por ID de usuario"""
    carrito = carritos.find_one({'user_id': user_id})
    if carrito:
        return jsonify({
            '_id': str(carrito['_id']),
            'user_id': carrito['user_id'],
            'items': carrito['items'],
            'total': carrito['total']
        })
    return jsonify({'error': 'Carrito no encontrado'}), 404


@app.route('/carrito/<carrito_id>', methods=['GET'])
def obtener_carrito(carrito_id):
    carrito = carritos.find_one({'_id': ObjectId(carrito_id)})
    if carrito:
        return jsonify({
            '_id': str(carrito['_id']),
            'user_id': carrito.get('user_id', ''),
            'items': carrito['items'],
            'total': carrito['total']
        })
    return jsonify({'error': 'Carrito no encontrado'}), 404


@app.route('/carrito/<carrito_id>/agregar', methods=['POST'])
def agregar_al_carrito(carrito_id):
    producto_id = request.json['producto_id']
    cantidad = request.json.get('cantidad', 1)

    producto = productos.find_one({'_id': ObjectId(producto_id)})
    if not producto:
        return jsonify({'error': 'Producto no encontrado'}), 404

    # Verificar el stock disponible
    stock_actual = producto.get('stock', 0)

    # Verificar si el producto ya está en el carrito
    carrito = carritos.find_one({'_id': ObjectId(carrito_id)})
    if not carrito:
        return jsonify({'error': 'Carrito no encontrado'}), 404

    # Verificar si el producto ya está en el carrito y calcular cantidad total
    producto_en_carrito = False
    for idx, item in enumerate(carrito['items']):
        if item['producto_id'] == producto_id:
            # Calcular nueva cantidad total
            nueva_cantidad = item['cantidad'] + cantidad

            # Verificar si hay suficiente stock
            if nueva_cantidad > stock_actual:
                return jsonify({
                    'error': 'Stock insuficiente',
                    'stock_disponible': stock_actual,
                    'cantidad_solicitada': nueva_cantidad
                }), 400

            # Actualizar cantidad si el producto ya está en el carrito
            carritos.update_one(
                {'_id': ObjectId(carrito_id)},
                {
                    '$set': {f'items.{idx}.cantidad': nueva_cantidad},
                    '$inc': {'total': producto['price'] * cantidad}
                }
            )
            producto_en_carrito = True
            break

    # Si el producto no está en el carrito, verificar stock y agregarlo
    if not producto_en_carrito:
        # Verificar si hay suficiente stock
        if cantidad > stock_actual:
            return jsonify({
                'error': 'Stock insuficiente',
                'stock_disponible': stock_actual,
                'cantidad_solicitada': cantidad
            }), 400

        # Si hay suficiente stock, agregar al carrito
        carritos.update_one(
            {'_id': ObjectId(carrito_id)},
            {
                '$push': {'items': {
                    'producto_id': producto_id,
                    'nombre': producto['name'],
                    'precio': producto['price'],
                    'cantidad': cantidad
                }},
                '$inc': {'total': producto['price'] * cantidad}
            }
        )
    return jsonify({'mensaje': 'Producto agregado al carrito'}), 200


@app.route('/carrito/<carrito_id>/eliminar/<item_index>', methods=['DELETE'])
def eliminar_del_carrito(carrito_id, item_index):
    carrito = carritos.find_one({'_id': ObjectId(carrito_id)})
    if not carrito:
        return jsonify({'error': 'Carrito no encontrado'}), 404

    try:
        item_index = int(item_index)
        if item_index < 0 or item_index >= len(carrito['items']):
            return jsonify({'error': 'Índice de item inválido'}), 400

        item = carrito['items'][item_index]
        carritos.update_one(
            {'_id': ObjectId(carrito_id)},
            {
                '$pull': {'items': item},
                '$inc': {'total': -item['precio'] * item['cantidad']}
            }
        )
        return jsonify({'mensaje': 'Item eliminado del carrito'}), 200
    except ValueError:
        return jsonify({'error': 'Índice de item inválido'}), 400


@app.route('/carrito/<carrito_id>/actualizar/<item_index>', methods=['PUT'])
def actualizar_cantidad_en_carrito(carrito_id, item_index):
    try:
        item_index = int(item_index)
        data = request.json
        nueva_cantidad = data['nueva_cantidad']
        diferencia_precio = data['diferencia_precio']

        carrito = carritos.find_one({'_id': ObjectId(carrito_id)})
        if not carrito:
            return jsonify({'error': 'Carrito no encontrado'}), 404

        if item_index < 0 or item_index >= len(carrito['items']):
            return jsonify({'error': 'Índice de item inválido'}), 400

        # Actualizar la cantidad del item
        carritos.update_one(
            {'_id': ObjectId(carrito_id)},
            {
                '$set': {f'items.{item_index}.cantidad': nueva_cantidad},
                '$inc': {'total': diferencia_precio}
            }
        )
        return jsonify({'mensaje': 'Cantidad actualizada'}), 200
    except ValueError:
        return jsonify({'error': 'Índice de item inválido'}), 400


# Ruta para procesar pagos
@app.route('/procesar-pago', methods=['POST'])
def procesar_pago():
    data = request.json
    user_id = data.get('user_id')
    carrito_id = data.get('carrito_id')
    payment_info = data.get('payment_info', {})

    # Verificar que existe el carrito
    try:
        carrito = carritos.find_one({'_id': ObjectId(carrito_id)})
        if not carrito:
            return jsonify({'error': 'Carrito no encontrado'}), 404

        # Verificar que el carrito tiene items
        if not carrito['items']:
            return jsonify({'error': 'El carrito está vacío'}), 400

        # Verificar stock disponible para todos los productos del carrito
        out_of_stock_items = []

        for item in carrito['items']:
            producto_id = item['producto_id']
            cantidad_solicitada = item['cantidad']

            # Buscar producto en la base de datos
            producto = productos.find_one({'_id': ObjectId(producto_id)})

            if not producto:
                return jsonify({'error': f'Producto con ID {producto_id} no encontrado'}), 404

            # Verificar si hay suficiente stock
            stock_actual = producto.get('stock', 0)
            if stock_actual < cantidad_solicitada:
                out_of_stock_items.append({
                    'nombre': producto['name'],
                    'stock_disponible': stock_actual,
                    'cantidad_solicitada': cantidad_solicitada
                })

        # Si hay productos sin stock suficiente, informar al cliente
        if out_of_stock_items:
            return jsonify({
                'error': 'Productos sin stock suficiente',
                'items_sin_stock': out_of_stock_items
            }), 400

        # Si todos los productos tienen stock, proceder con la transacción

        # Actualizar stock de productos
        for item in carrito['items']:
            producto_id = item['producto_id']
            cantidad = item['cantidad']

            # Restar la cantidad del stock
            productos.update_one(
                {'_id': ObjectId(producto_id)},
                {'$inc': {'stock': -cantidad}}
            )

        # Generar ID único para el pago
        payment_id = str(uuid.uuid4())
        fecha_actual = datetime.now().strftime("%d-%m-%Y %H:%M:%S")

        # Crear registro de pago
        payment_record = {
            'payment_id': payment_id,
            'user_id': user_id,
            'carrito_id': str(carrito['_id']),
            'items': carrito['items'],
            'total': carrito['total'],
            'date': fecha_actual,
            'payment_info': payment_info,
            'status': 'completed'
        }

        # Guardar el pago en la colección de pagos
        payments.insert_one(payment_record)

        # Vaciar el carrito (mantenerlo pero sin items)
        carritos.update_one(
            {'_id': ObjectId(carrito_id)},
            {'$set': {'items': [], 'total': 0}}
        )

        user = users.find_one({'_id': ObjectId(user_id)})
        address_info = None

        if user and 'address_id' in user:
            address = db.addresses.find_one({'_id': ObjectId(user['address_id'])})
            if address:
                address_info = {
                    'street': address.get('street'),
                    'number': address.get('number'),
                    'city': address.get('city'),
                    'state': address.get('state'),
                    'zip_code': address.get('zip_code'),
                    'country': address.get('country')
                }

        # Add product providers to each item in the payment record
        items_with_providers = []
        for item in carrito['items']:
            producto = productos.find_one({'_id': ObjectId(item['producto_id'])})
            provider = producto.get('provider', 'No especificado')
            item_with_provider = item.copy()
            item_with_provider['provider'] = provider
            items_with_providers.append(item_with_provider)

        # Update payment_record definition to include address and provider info
        payment_record = {
            'payment_id': payment_id,
            'user_id': user_id,
            'carrito_id': str(carrito['_id']),
            'items': items_with_providers,  # Updated to include providers
            'total': carrito['total'],
            'date': fecha_actual,
            'payment_info': payment_info,
            'address': address_info,  # Add address info
            'status': 'completed'
        }

        # Devolver información del pago
        # Update the return statement in procesar-pago route
        return jsonify({
            'success': True,
            'payment_id': payment_id,
            'date': fecha_actual,
            'items': items_with_providers,  # Return items with provider info
            'total': carrito['total'],
            'address': address_info  # Return address info
        })

    except Exception as e:
        print(f"Error procesando pago: {str(e)}")
        return jsonify({'error': f'Error al procesar el pago: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
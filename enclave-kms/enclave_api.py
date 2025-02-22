from flask import Flask, request, jsonify
from flask_cors import CORS
import enclave_kms as keymanager

app = Flask(__name__)
CORS(app)

@app.route('/generate', methods=['POST'])
def generate():
    """Generate a new Ethereum account and store it encrypted in the enclave"""
    account = keymanager.generate_ethereum_account()
    encrypted = keymanager.encrypt_key(account['private_key'])
    keymanager.store_key(account['address'], encrypted)
    
    return jsonify({
        "address": account['address'],
        "message": "Account generated and stored in enclave"
    })

@app.route('/addresses', methods=['GET'])
def addresses():
    """List all addresses stored in the enclave"""
    return jsonify(keymanager.list_addresses())

@app.route('/sign', methods=['POST'])
def sign():
    """Sign a message using a private key stored in the enclave"""
    address = request.json.get('address')
    message = request.json.get('message')
    
    if not address or not message:
        return jsonify({"error": "Address and message required"}), 400
    
    encrypted = keymanager.get_key(address)
    if not encrypted:
        return jsonify({"error": "Address not found"}), 404
    
    # Decrypt using enclave secret
    private_key = keymanager.decrypt_key(encrypted)
    if not private_key:
        return jsonify({"error": "Failed to decrypt key"}), 500
    
    # Sign the message
    signature = keymanager.sign_message(message, private_key)
    return jsonify({"signature": signature})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
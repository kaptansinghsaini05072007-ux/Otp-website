class OTPService {
    constructor() {
        this.apiKey = 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3OTQyMDk4NjQsImlhdCI6MTc2MjY3Mzg2NCwicmF5IjoiOTMwN2EwYTk3ZTBlODEzYjM1NzJkMWJlNGI5YzFlNjQiLCJzdWIiOjMwOTA0Mzl9.DSBVHlWaSFPHLdfRYquEXaI5-1K7DFMG7s7N4W3qHumEy7YYpfmnG6RxgaIgOwgFlGsu4JPA4P_fUw6JvTizOhlbo75TT2-H1Z-8cF44meKBa0jr1CjvjEmwV3a6okY02UgEDGx9fHQIRegBNCG2okHoCWJWBJ1RCUu-vCcDl7c4CAQagNmCkfDNzx8JXDG3iHYir_gOROzxf9HUlC5dbzNze9IhuPce64SLGPls60wfD2W8D4XeoNc1uay0KqmcdWGrACn1zLNzFZPnYqs5cWtByLRwFqN-kwm1BwtqI8mP-ZK5-66qqhakP7K96N0ocmFGLnCa-5a4e0fTMTGQZw';
        this.baseURL = 'https://5sim.net/v1/';
        this.currentOrder = null;
        this.pollInterval = null;
        this.userBalance = 50.00;
        this.priceMultiplier = 1.75;
        
        this.init();
    }
    
    async init() {
        // Check API connection
        const connected = await this.checkAPIConnection();
        
        if (connected) {
            await this.loadCountries();
            this.showNotification('✅ 5SIM API Connected', 'success');
        } else {
            // If API fails, show error and stop
            this.showNotification('❌ 5SIM API Connection Failed. Please check API key or try again later.', 'error');
            document.getElementById('countrySelect').innerHTML = '<option value="">API Connection Failed</option>';
            return;
        }
        
        this.setupEventListeners();
        this.updateBalanceDisplay();
    }
    
    async checkAPIConnection() {
        try {
            const response = await this.makeRequest('user/profile', 'GET', true);
            return true;
        } catch (error) {
            console.error('API Connection Failed:', error);
            return false;
        }
    }
    
    async makeRequest(endpoint, method = 'GET', auth = false) {
        const url = this.baseURL + endpoint;
        
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        
        if (auth) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        
        try {
            console.log(`API Request: ${url}`);
            
            const response = await fetch(url, {
                method: method,
                headers: headers
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error(`API Request failed:`, error);
            
            // Try with CORS proxy
            if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
                return await this.makeRequestWithProxy(endpoint, method, auth);
            }
            
            throw error;
        }
    }
    
    async makeRequestWithProxy(endpoint, method = 'GET', auth = false) {
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const url = proxyUrl + this.baseURL + endpoint;
        
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        
        if (auth) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        
        try {
            console.log(`Proxied API Request: ${url}`);
            
            const response = await fetch(url, {
                method: method,
                headers: headers
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error(`Proxied API Request failed:`, error);
            throw new Error('5SIM service is currently unavailable. Please try again later.');
        }
    }
    
    async loadCountries() {
        try {
            const response = await this.makeRequest('guest/products');
            this.populateCountries(response);
        } catch (error) {
            console.error('Error loading countries:', error);
            this.showNotification('Failed to load countries from 5SIM', 'error');
            document.getElementById('countrySelect').innerHTML = '<option value="">Failed to load countries</option>';
        }
    }
    
    populateCountries(countriesData) {
        const countrySelect = document.getElementById('countrySelect');
        countrySelect.innerHTML = '<option value="">Select Country</option>';
        
        Object.keys(countriesData).forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = this.formatCountryName(country);
            countrySelect.appendChild(option);
        });
    }
    
    setupEventListeners() {
        document.getElementById('countrySelect').addEventListener('change', (e) => {
            this.onCountryChange(e.target.value);
        });
        
        document.getElementById('serviceSelect').addEventListener('change', (e) => {
            this.onServiceChange(e.target.value);
        });
    }
    
    async onCountryChange(country) {
        if (!country) {
            document.getElementById('serviceSelect').innerHTML = '<option value="">Select country first</option>';
            document.getElementById('operatorSelect').innerHTML = '<option value="any">Any Operator</option>';
            this.hidePrice();
            return;
        }
        
        try {
            const services = await this.loadServices(country);
            this.populateServices(services, country);
            await this.loadOperators(country);
        } catch (error) {
            console.error('Error loading services:', error);
            this.showNotification('Failed to load services for this country', 'error');
        }
    }
    
    async loadServices(country) {
        const response = await this.makeRequest(`guest/products/${country}`);
        return response;
    }
    
    populateServices(servicesData, country) {
        const serviceSelect = document.getElementById('serviceSelect');
        serviceSelect.innerHTML = '<option value="">Select Service</option>';
        
        Object.keys(servicesData).forEach(service => {
            if (servicesData[service].Category === 'activation') {
                const option = document.createElement('option');
                option.value = service;
                option.textContent = this.formatServiceName(service);
                serviceSelect.appendChild(option);
            }
        });
    }
    
    async loadOperators(country) {
        try {
            const serviceSelect = document.getElementById('serviceSelect');
            if (serviceSelect.options.length > 1) {
                const firstService = serviceSelect.options[1].value;
                const response = await this.makeRequest(`guest/prices?country=${country}&product=${firstService}`);
                this.populateOperators(response, country);
            }
        } catch (error) {
            console.error('Error loading operators:', error);
        }
    }
    
    populateOperators(pricesData, country) {
        const operatorSelect = document.getElementById('operatorSelect');
        operatorSelect.innerHTML = '<option value="any">Any Operator</option>';
        
        if (pricesData[country]) {
            const firstService = Object.keys(pricesData[country])[0];
            if (firstService && pricesData[country][firstService]) {
                Object.keys(pricesData[country][firstService]).forEach(operator => {
                    const option = document.createElement('option');
                    option.value = operator;
                    option.textContent = this.formatOperatorName(operator);
                    operatorSelect.appendChild(option);
                });
            }
        }
    }
    
    async onServiceChange(service) {
        const country = document.getElementById('countrySelect').value;
        if (!country || !service) {
            this.hidePrice();
            return;
        }
        
        try {
            const price = await this.getServicePrice(country, service);
            this.showPrice(price);
        } catch (error) {
            console.error('Error getting price:', error);
        }
    }
    
    async getServicePrice(country, service) {
        const operator = document.getElementById('operatorSelect').value;
        let endpoint = `guest/prices?country=${country}&product=${service}`;
        
        const response = await this.makeRequest(endpoint);
        
        if (response[country] && response[country][service]) {
            const operators = response[country][service];
            
            if (operator !== 'any' && operators[operator]) {
                return operators[operator].cost;
            }
            
            const firstOperator = Object.keys(operators)[0];
            return operators[firstOperator]?.cost || 2;
        }
        
        return 2;
    }
    
    showPrice(originalPrice) {
        const ourPrice = this.calculateOurPrice(originalPrice);
        document.getElementById('estimatedPrice').textContent = ourPrice;
        document.getElementById('priceInfo').classList.remove('hidden');
        
        const buyButton = document.getElementById('buyButton');
        buyButton.disabled = ourPrice > this.userBalance;
        buyButton.textContent = ourPrice > this.userBalance ? 'Insufficient Balance' : 'Buy Number';
    }
    
    hidePrice() {
        document.getElementById('priceInfo').classList.add('hidden');
        document.getElementById('buyButton').disabled = true;
    }
    
    calculateOurPrice(originalPriceUSD) {
        const usdToInr = 83;
        const priceInr = originalPriceUSD * usdToInr;
        return Math.ceil(priceInr * this.priceMultiplier);
    }
    
    async buyNumber() {
        const country = document.getElementById('countrySelect').value;
        const service = document.getElementById('serviceSelect').value;
        const operator = document.getElementById('operatorSelect').value;
        
        if (!country || !service) {
            this.showNotification('Please select country and service', 'error');
            return;
        }
        
        const buyButton = document.getElementById('buyButton');
        buyButton.disabled = true;
        buyButton.textContent = 'Buying Number...';
        
        try {
            const finalOperator = operator === 'any' ? 'any' : operator;
            const order = await this.placeOrder(country, finalOperator, service);
            
            const originalPrice = await this.getServicePrice(country, service);
            const ourPrice = this.calculateOurPrice(originalPrice);
            this.userBalance -= ourPrice;
            this.updateBalanceDisplay();
            
            this.currentOrder = order;
            this.showOrderStatus();
            this.startSMSPolling();
            
            this.showNotification('✅ Number purchased successfully! Waiting for SMS...', 'success');
            
        } catch (error) {
            console.error('Error buying number:', error);
            this.showNotification('Failed to buy number: ' + (error.message || 'Service unavailable'), 'error');
        } finally {
            buyButton.disabled = false;
            buyButton.textContent = 'Buy Number';
        }
    }
    
    async placeOrder(country, operator, product) {
        const endpoint = `user/buy/activation/${country}/${operator}/${product}`;
        return await this.makeRequest(endpoint, 'GET', true);
    }
    
    showOrderStatus() {
        document.getElementById('currentNumber').textContent = this.currentOrder.phone;
        document.getElementById('orderService').textContent = `Service: ${this.formatServiceName(this.currentOrder.product)}`;
        document.getElementById('orderCountry').textContent = `Country: ${this.formatCountryName(this.currentOrder.country)}`;
        document.getElementById('orderStatus').classList.remove('hidden');
        
        document.getElementById('orderStatus').scrollIntoView({ behavior: 'smooth' });
    }
    
    startSMSPolling() {
        this.pollInterval = setInterval(async () => {
            await this.checkSMS();
        }, 5000);
    }
    
    async checkSMS() {
        if (!this.currentOrder) return;
        
        try {
            const orderInfo = await this.makeRequest(`user/check/${this.currentOrder.id}`, 'GET', true);
            
            if (orderInfo.sms && orderInfo.sms.length > 0) {
                const latestSMS = orderInfo.sms[orderInfo.sms.length - 1];
                this.displaySMS(latestSMS);
                clearInterval(this.pollInterval);
                this.showNotification('✅ SMS Received!', 'success');
            }
        } catch (error) {
            console.error('Error checking SMS:', error);
        }
    }
    
    displaySMS(sms) {
        const smsInbox = document.getElementById('smsInbox');
        smsInbox.innerHTML = `
            <div style="color: #4CAF50; font-weight: bold; margin-bottom: 10px;">✅ SMS Received!</div>
            <div><strong>From:</strong> ${sms.sender || 'Unknown'}</div>
            <div><strong>Text:</strong> ${sms.text}</div>
            ${sms.code ? `<div><strong>Code:</strong> ${sms.code}</div>` : ''}
            <div style="margin-top: 10px; font-size: 0.9em; color: #666;">Received at: ${new Date(sms.created_at).toLocaleTimeString()}</div>
        `;
    }
    
    closeOrder() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        this.currentOrder = null;
        document.getElementById('orderStatus').classList.add('hidden');
        this.showNotification('Order closed', 'info');
    }
    
    updateBalanceDisplay() {
        document.getElementById('userBalance').textContent = this.userBalance.toFixed(2);
    }
    
    formatCountryName(country) {
        return country.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }
    
    formatServiceName(service) {
        return service.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }
    
    formatOperatorName(operator) {
        return operator.charAt(0).toUpperCase() + operator.slice(1);
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        if (type === 'success') {
            notification.style.background = '#4CAF50';
        } else if (type === 'error') {
            notification.style.background = '#e74c3c';
        } else {
            notification.style.background = '#3498db';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

let otpService;
document.addEventListener('DOMContentLoaded', () => {
    otpService = new OTPService();
});

function buyNumber() {
    if (otpService) {
        otpService.buyNumber();
    }
}

function closeOrder() {
    if (otpService) {
        otpService.closeOrder();
    }
}

import crypto from 'crypto';
import axios from 'axios';

class PayFastService {
    constructor() {
        this.merchantId = process.env.PAYFAST_MERCHANT_ID;
        this.merchantKey = process.env.PAYFAST_MERCHANT_KEY;
        this.passphrase = process.env.PAYFAST_PASSPHRASE;
        this.baseUrl = process.env.NODE_ENV === 'production' 
            ? 'https://www.payfast.co.za/eng/process'
            : 'https://sandbox.payfast.co.za/eng/process';
        this.apiUrl = process.env.NODE_ENV === 'production'
            ? 'https://api.payfast.co.za'
            : 'https://api.sandbox.payfast.co.za';
        
        // Debug logging (only in development or when debugging)
        console.log('🔧 PayFast Service initialized:');
        console.log(`  - Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`  - API URL: ${this.apiUrl}`);
        console.log(`  - Merchant ID: ${this.merchantId ? this.merchantId.substring(0, 4) + '****' : 'NOT SET'}`);
        console.log(`  - Merchant Key: ${this.merchantKey ? '****' + this.merchantKey.substring(this.merchantKey.length - 4) : 'NOT SET'}`);
        console.log(`  - Passphrase: ${this.passphrase ? 'SET' : 'NOT SET'}`);
    }

    // Generate PayFast signature
    generateSignature(data, passphrase = null) {
        const orderedData = {};
        Object.keys(data).sort().forEach(key => {
            orderedData[key] = data[key];
        });

        let queryString = new URLSearchParams(orderedData).toString();
        if (passphrase) {
            queryString += `&passphrase=${encodeURIComponent(passphrase)}`;
        }

        return crypto.createHash('md5').update(queryString).digest('hex');
    }

    // Create payment request
    async createPayment(paymentData) {
        try {
            const {
                amount,
                item_name,
                item_description,
                custom_int1, // subscription_id
                custom_str1, // user_id
                email_address,
                name_first,
                name_last,
                return_url,
                cancel_url,
                notify_url
            } = paymentData;

            // Validate required fields
            if (!amount || !item_name || !email_address || !name_first || !name_last) {
                throw new Error('Missing required payment fields');
            }

            // Generate unique payment reference
            const paymentRef = `SUB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const data = {
                merchant_id: this.merchantId,
                merchant_key: this.merchantKey,
                return_url: return_url,
                cancel_url: cancel_url,
                notify_url: notify_url,
                name_first: name_first,
                name_last: name_last,
                email_address: email_address,
                m_payment_id: paymentRef,
                amount: parseFloat(amount).toFixed(2),
                item_name: item_name,
                item_description: item_description || item_name,
                custom_int1: custom_int1,
                custom_str1: custom_str1,
                custom_str2: 'youngeagles_subscription',
                custom_str3: process.env.NODE_ENV || 'development'
            };

            // Generate signature
            const signature = this.generateSignature(data, this.passphrase);
            data.signature = signature;

            // Create form data for redirect
            const formData = new URLSearchParams(data);
            const checkoutUrl = `${this.baseUrl}?${formData.toString()}`;

            return {
                success: true,
                checkout_url: checkoutUrl,
                transaction_id: paymentRef,
                data: data
            };

        } catch (error) {
            console.error('PayFast payment creation error:', error);
            throw new Error(`PayFast payment creation failed: ${error.message}`);
        }
    }

    // Verify PayFast payment notification
    async verifyPayment(postData) {
        try {
            const {
                m_payment_id,
                pf_payment_id,
                payment_status,
                item_name,
                amount_gross,
                amount_fee,
                amount_net,
                custom_int1,
                custom_str1,
                signature
            } = postData;

            // Remove signature from data for verification
            const dataToVerify = { ...postData };
            delete dataToVerify.signature;

            // Generate signature for verification
            const calculatedSignature = this.generateSignature(dataToVerify, this.passphrase);

            // Verify signature
            if (signature !== calculatedSignature) {
                throw new Error('Invalid signature');
            }

            // Additional verification via PayFast API
            const isValid = await this.validatePaymentWithAPI(pf_payment_id);

            if (!isValid) {
                throw new Error('Payment validation failed');
            }

            return {
                success: true,
                verified: true,
                payment_id: pf_payment_id,
                merchant_payment_id: m_payment_id,
                status: payment_status,
                amount: parseFloat(amount_gross),
                fee: parseFloat(amount_fee || 0),
                net_amount: parseFloat(amount_net),
                subscription_id: custom_int1,
                user_id: custom_str1,
                item_name: item_name,
                raw_data: postData
            };

        } catch (error) {
            console.error('PayFast payment verification error:', error);
            return {
                success: false,
                verified: false,
                error: error.message,
                raw_data: postData
            };
        }
    }

    // Validate payment with PayFast API
    async validatePaymentWithAPI(paymentId) {
        try {
            const timestamp = new Date().toISOString();
            const data = {
                merchant_id: this.merchantId,
                version: 'v1',
                timestamp: timestamp
            };

            const signature = this.generateSignature(data, this.passphrase);
            data.signature = signature;

            const response = await axios.get(`${this.apiUrl}/subscriptions/${paymentId}/adhoc`, {
                params: data,
                headers: {
                    'merchant-id': this.merchantId,
                    'version': 'v1',
                    'timestamp': timestamp,
                    'signature': signature
                },
                timeout: 10000
            });

            return response.status === 200 && response.data.status === 'success';

        } catch (error) {
            console.error('PayFast API validation error:', error);
            return false;
        }
    }

    // Create subscription (recurring payment)
    async createSubscription(subscriptionData) {
        try {
            const {
                amount,
                cycles,
                frequency,
                subscription_type,
                item_name,
                item_description,
                email_address,
                name_first,
                name_last,
                return_url,
                cancel_url,
                notify_url,
                custom_int1,
                custom_str1
            } = subscriptionData;

            const subscriptionRef = `SUBSRC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const data = {
                merchant_id: this.merchantId,
                merchant_key: this.merchantKey,
                return_url: return_url,
                cancel_url: cancel_url,
                notify_url: notify_url,
                name_first: name_first,
                name_last: name_last,
                email_address: email_address,
                m_payment_id: subscriptionRef,
                amount: parseFloat(amount).toFixed(2),
                item_name: item_name,
                item_description: item_description || item_name,
                subscription_type: subscription_type || '2', // Recurring
                billing_date: new Date().toISOString().split('T')[0],
                recurring_amount: parseFloat(amount).toFixed(2),
                frequency: frequency || '3', // Monthly
                cycles: cycles || '0', // Indefinite
                custom_int1: custom_int1,
                custom_str1: custom_str1,
                custom_str2: 'youngeagles_recurring',
                custom_str3: process.env.NODE_ENV || 'development'
            };

            const signature = this.generateSignature(data, this.passphrase);
            data.signature = signature;

            const formData = new URLSearchParams(data);
            const checkoutUrl = `${this.baseUrl}?${formData.toString()}`;

            return {
                success: true,
                checkout_url: checkoutUrl,
                subscription_id: subscriptionRef,
                data: data
            };

        } catch (error) {
            console.error('PayFast subscription creation error:', error);
            throw new Error(`PayFast subscription creation failed: ${error.message}`);
        }
    }

    // Cancel subscription
    async cancelSubscription(subscriptionToken) {
        try {
            const timestamp = new Date().toISOString();
            const data = {
                merchant_id: this.merchantId,
                version: 'v1',
                timestamp: timestamp
            };

            const signature = this.generateSignature(data, this.passphrase);

            const response = await axios.put(
                `${this.apiUrl}/subscriptions/${subscriptionToken}/cancel`,
                {},
                {
                    headers: {
                        'merchant-id': this.merchantId,
                        'version': 'v1',
                        'timestamp': timestamp,
                        'signature': signature,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            return {
                success: response.status === 200,
                message: response.data?.message || 'Subscription cancelled',
                data: response.data
            };

        } catch (error) {
            console.error('PayFast subscription cancellation error:', error);
            throw new Error(`PayFast subscription cancellation failed: ${error.message}`);
        }
    }

    // Get subscription status
    async getSubscriptionStatus(subscriptionToken) {
        try {
            const timestamp = new Date().toISOString();
            const data = {
                merchant_id: this.merchantId,
                version: 'v1',
                timestamp: timestamp
            };

            const signature = this.generateSignature(data, this.passphrase);

            const response = await axios.get(`${this.apiUrl}/subscriptions/${subscriptionToken}/fetch`, {
                headers: {
                    'merchant-id': this.merchantId,
                    'version': 'v1',
                    'timestamp': timestamp,
                    'signature': signature
                },
                timeout: 10000
            });

            return {
                success: response.status === 200,
                data: response.data
            };

        } catch (error) {
            console.error('PayFast subscription status error:', error);
            throw new Error(`PayFast subscription status fetch failed: ${error.message}`);
        }
    }

    // Process refund
    async processRefund(paymentId, amount, reason = null) {
        try {
            const timestamp = new Date().toISOString();
            const data = {
                merchant_id: this.merchantId,
                version: 'v1',
                timestamp: timestamp,
                amount: parseFloat(amount).toFixed(2)
            };

            if (reason) {
                data.reason = reason;
            }

            const signature = this.generateSignature(data, this.passphrase);

            const response = await axios.post(
                `${this.apiUrl}/refunds`,
                {
                    payment_id: paymentId,
                    amount: parseFloat(amount).toFixed(2),
                    reason: reason || 'User requested refund'
                },
                {
                    headers: {
                        'merchant-id': this.merchantId,
                        'version': 'v1',
                        'timestamp': timestamp,
                        'signature': signature,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            return {
                success: response.status === 200,
                refund_id: response.data?.refund_id,
                message: response.data?.message || 'Refund processed',
                data: response.data
            };

        } catch (error) {
            console.error('PayFast refund error:', error);
            throw new Error(`PayFast refund failed: ${error.message}`);
        }
    }

    // Get transaction history
    async getTransactionHistory(fromDate, toDate) {
        try {
            const timestamp = new Date().toISOString();
            const data = {
                merchant_id: this.merchantId,
                version: 'v1',
                timestamp: timestamp,
                from: fromDate,
                to: toDate
            };

            const signature = this.generateSignature(data, this.passphrase);

            const response = await axios.get(`${this.apiUrl}/transactions/history`, {
                params: data,
                headers: {
                    'merchant-id': this.merchantId,
                    'version': 'v1',
                    'timestamp': timestamp,
                    'signature': signature
                },
                timeout: 10000
            });

            return {
                success: response.status === 200,
                transactions: response.data?.transactions || [],
                data: response.data
            };

        } catch (error) {
            console.error('PayFast transaction history error:', error);
            throw new Error(`PayFast transaction history fetch failed: ${error.message}`);
        }
    }

    // Validate webhook IP (security check)
    validateWebhookIP(req) {
        const clientIP = req.ip || req.connection.remoteAddress;
        const payfastIPs = [
            '197.97.145.144',
            '41.74.179.194',
            '197.97.145.145',
            '41.74.179.195'
        ];

        return payfastIPs.includes(clientIP);
    }

    // Test connection
    async testConnection() {
        try {
            const timestamp = new Date().toISOString();
            const data = {
                merchant_id: this.merchantId,
                version: 'v1',
                timestamp: timestamp
            };

            const signature = this.generateSignature(data, this.passphrase);
            
            // Debug logging
            console.log('🔍 PayFast test connection attempt:');
            console.log(`  - URL: ${this.apiUrl}/ping`);
            console.log(`  - Timestamp: ${timestamp}`);
            console.log(`  - Signature: ${signature}`);

            const response = await axios.get(`${this.apiUrl}/ping`, {
                headers: {
                    'merchant-id': this.merchantId,
                    'version': 'v1',
                    'timestamp': timestamp,
                    'signature': signature
                },
                timeout: 5000
            });

            return {
                success: response.status === 200,
                message: 'PayFast connection successful',
                data: response.data
            };

        } catch (error) {
            console.error('PayFast connection test error:', error);
            return {
                success: false,
                message: `PayFast connection failed: ${error.message}`
            };
        }
    }
}

export default new PayFastService(); 
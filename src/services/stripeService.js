import Stripe from 'stripe';

class StripeService {
    constructor() {
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        this.publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
        this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    }

    // Create payment intent for one-time payment
    async createPaymentIntent(paymentData) {
        try {
            const {
                amount,
                currency = 'zar',
                customer_email,
                description,
                metadata = {},
                payment_method_types = ['card'],
                confirm = false,
                return_url
            } = paymentData;

            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: amount, // Amount in cents
                currency: currency.toLowerCase(),
                payment_method_types: payment_method_types,
                confirm: confirm,
                description: description || 'YoungEagles Subscription',
                metadata: {
                    ...metadata,
                    platform: 'youngeagles',
                    created_at: new Date().toISOString()
                },
                receipt_email: customer_email,
                return_url: return_url
            });

            return {
                success: true,
                id: paymentIntent.id,
                client_secret: paymentIntent.client_secret,
                status: paymentIntent.status,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                payment_intent: paymentIntent
            };

        } catch (error) {
            console.error('Stripe payment intent creation error:', error);
            throw new Error(`Stripe payment intent creation failed: ${error.message}`);
        }
    }

    // Create customer
    async createCustomer(customerData) {
        try {
            const {
                email,
                name,
                phone,
                address,
                metadata = {}
            } = customerData;

            const customer = await this.stripe.customers.create({
                email: email,
                name: name,
                phone: phone,
                address: address,
                metadata: {
                    ...metadata,
                    platform: 'youngeagles',
                    created_at: new Date().toISOString()
                }
            });

            return {
                success: true,
                customer_id: customer.id,
                customer: customer
            };

        } catch (error) {
            console.error('Stripe customer creation error:', error);
            throw new Error(`Stripe customer creation failed: ${error.message}`);
        }
    }

    // Get or create customer
    async getOrCreateCustomer(customerData) {
        try {
            const { email } = customerData;

            // Try to find existing customer
            const existingCustomers = await this.stripe.customers.list({
                email: email,
                limit: 1
            });

            if (existingCustomers.data.length > 0) {
                return {
                    success: true,
                    customer_id: existingCustomers.data[0].id,
                    customer: existingCustomers.data[0],
                    created: false
                };
            }

            // Create new customer
            const result = await this.createCustomer(customerData);
            return {
                ...result,
                created: true
            };

        } catch (error) {
            console.error('Stripe get/create customer error:', error);
            throw new Error(`Stripe customer operation failed: ${error.message}`);
        }
    }

    // Create subscription
    async createSubscription(subscriptionData) {
        try {
            const {
                customer_id,
                price_id,
                trial_period_days = 0,
                metadata = {},
                collection_method = 'charge_automatically'
            } = subscriptionData;

            const subscription = await this.stripe.subscriptions.create({
                customer: customer_id,
                items: [{ price: price_id }],
                payment_behavior: 'default_incomplete',
                payment_settings: {
                    payment_method_types: ['card'],
                    save_default_payment_method: 'on_subscription'
                },
                collection_method: collection_method,
                trial_period_days: trial_period_days,
                metadata: {
                    ...metadata,
                    platform: 'youngeagles',
                    created_at: new Date().toISOString()
                },
                expand: ['latest_invoice.payment_intent']
            });

            return {
                success: true,
                subscription_id: subscription.id,
                client_secret: subscription.latest_invoice.payment_intent.client_secret,
                status: subscription.status,
                subscription: subscription
            };

        } catch (error) {
            console.error('Stripe subscription creation error:', error);
            throw new Error(`Stripe subscription creation failed: ${error.message}`);
        }
    }

    // Create price for subscription
    async createPrice(priceData) {
        try {
            const {
                product_id,
                unit_amount,
                currency = 'zar',
                recurring_interval = 'month',
                recurring_interval_count = 1,
                nickname
            } = priceData;

            const price = await this.stripe.prices.create({
                product: product_id,
                unit_amount: unit_amount, // Amount in cents
                currency: currency.toLowerCase(),
                recurring: {
                    interval: recurring_interval,
                    interval_count: recurring_interval_count
                },
                nickname: nickname
            });

            return {
                success: true,
                price_id: price.id,
                price: price
            };

        } catch (error) {
            console.error('Stripe price creation error:', error);
            throw new Error(`Stripe price creation failed: ${error.message}`);
        }
    }

    // Create product
    async createProduct(productData) {
        try {
            const {
                name,
                description,
                images = [],
                metadata = {}
            } = productData;

            const product = await this.stripe.products.create({
                name: name,
                description: description,
                images: images,
                metadata: {
                    ...metadata,
                    platform: 'youngeagles',
                    created_at: new Date().toISOString()
                }
            });

            return {
                success: true,
                product_id: product.id,
                product: product
            };

        } catch (error) {
            console.error('Stripe product creation error:', error);
            throw new Error(`Stripe product creation failed: ${error.message}`);
        }
    }

    // Update subscription
    async updateSubscription(subscriptionId, updateData) {
        try {
            const {
                items,
                metadata,
                trial_end,
                proration_behavior = 'create_prorations'
            } = updateData;

            const subscription = await this.stripe.subscriptions.update(subscriptionId, {
                items: items,
                metadata: metadata,
                trial_end: trial_end,
                proration_behavior: proration_behavior
            });

            return {
                success: true,
                subscription_id: subscription.id,
                status: subscription.status,
                subscription: subscription
            };

        } catch (error) {
            console.error('Stripe subscription update error:', error);
            throw new Error(`Stripe subscription update failed: ${error.message}`);
        }
    }

    // Cancel subscription
    async cancelSubscription(subscriptionId, immediately = false) {
        try {
            let subscription;

            if (immediately) {
                subscription = await this.stripe.subscriptions.cancel(subscriptionId);
            } else {
                subscription = await this.stripe.subscriptions.update(subscriptionId, {
                    cancel_at_period_end: true
                });
            }

            return {
                success: true,
                subscription_id: subscription.id,
                status: subscription.status,
                canceled_at: subscription.canceled_at,
                cancel_at_period_end: subscription.cancel_at_period_end,
                subscription: subscription
            };

        } catch (error) {
            console.error('Stripe subscription cancellation error:', error);
            throw new Error(`Stripe subscription cancellation failed: ${error.message}`);
        }
    }

    // Reactivate subscription
    async reactivateSubscription(subscriptionId) {
        try {
            const subscription = await this.stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: false
            });

            return {
                success: true,
                subscription_id: subscription.id,
                status: subscription.status,
                subscription: subscription
            };

        } catch (error) {
            console.error('Stripe subscription reactivation error:', error);
            throw new Error(`Stripe subscription reactivation failed: ${error.message}`);
        }
    }

    // Get subscription
    async getSubscription(subscriptionId) {
        try {
            const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

            return {
                success: true,
                subscription: subscription
            };

        } catch (error) {
            console.error('Stripe subscription retrieval error:', error);
            throw new Error(`Stripe subscription retrieval failed: ${error.message}`);
        }
    }

    // Process webhook
    async processWebhook(body, signature) {
        try {
            const event = this.stripe.webhooks.constructEvent(
                body,
                signature,
                this.webhookSecret
            );

            let result = { success: true, event: event };

            switch (event.type) {
                case 'payment_intent.succeeded':
                    result.payment_intent = event.data.object;
                    break;

                case 'payment_intent.payment_failed':
                    result.payment_intent = event.data.object;
                    break;

                case 'invoice.payment_succeeded':
                    result.invoice = event.data.object;
                    break;

                case 'invoice.payment_failed':
                    result.invoice = event.data.object;
                    break;

                case 'customer.subscription.created':
                    result.subscription = event.data.object;
                    break;

                case 'customer.subscription.updated':
                    result.subscription = event.data.object;
                    break;

                case 'customer.subscription.deleted':
                    result.subscription = event.data.object;
                    break;

                case 'customer.subscription.trial_will_end':
                    result.subscription = event.data.object;
                    break;

                default:
                    console.log(`Unhandled Stripe event type: ${event.type}`);
                    result.unhandled = true;
            }

            return result;

        } catch (error) {
            console.error('Stripe webhook processing error:', error);
            throw new Error(`Stripe webhook processing failed: ${error.message}`);
        }
    }

    // Create refund
    async createRefund(refundData) {
        try {
            const {
                payment_intent_id,
                amount,
                reason = 'requested_by_customer',
                metadata = {}
            } = refundData;

            const refund = await this.stripe.refunds.create({
                payment_intent: payment_intent_id,
                amount: amount,
                reason: reason,
                metadata: {
                    ...metadata,
                    platform: 'youngeagles',
                    created_at: new Date().toISOString()
                }
            });

            return {
                success: true,
                refund_id: refund.id,
                amount: refund.amount,
                status: refund.status,
                refund: refund
            };

        } catch (error) {
            console.error('Stripe refund creation error:', error);
            throw new Error(`Stripe refund creation failed: ${error.message}`);
        }
    }

    // Get payment history
    async getPaymentHistory(customerId, limit = 10) {
        try {
            const charges = await this.stripe.charges.list({
                customer: customerId,
                limit: limit
            });

            return {
                success: true,
                charges: charges.data,
                has_more: charges.has_more
            };

        } catch (error) {
            console.error('Stripe payment history error:', error);
            throw new Error(`Stripe payment history retrieval failed: ${error.message}`);
        }
    }

    // Get invoices
    async getInvoices(customerId, limit = 10) {
        try {
            const invoices = await this.stripe.invoices.list({
                customer: customerId,
                limit: limit
            });

            return {
                success: true,
                invoices: invoices.data,
                has_more: invoices.has_more
            };

        } catch (error) {
            console.error('Stripe invoices retrieval error:', error);
            throw new Error(`Stripe invoices retrieval failed: ${error.message}`);
        }
    }

    // Create checkout session
    async createCheckoutSession(sessionData) {
        try {
            const {
                customer_email,
                line_items,
                mode = 'payment',
                success_url,
                cancel_url,
                metadata = {},
                subscription_data = {},
                payment_intent_data = {}
            } = sessionData;

            const session = await this.stripe.checkout.sessions.create({
                customer_email: customer_email,
                line_items: line_items,
                mode: mode,
                success_url: success_url,
                cancel_url: cancel_url,
                metadata: {
                    ...metadata,
                    platform: 'youngeagles',
                    created_at: new Date().toISOString()
                },
                subscription_data: mode === 'subscription' ? subscription_data : undefined,
                payment_intent_data: mode === 'payment' ? payment_intent_data : undefined
            });

            return {
                success: true,
                session_id: session.id,
                checkout_url: session.url,
                session: session
            };

        } catch (error) {
            console.error('Stripe checkout session creation error:', error);
            throw new Error(`Stripe checkout session creation failed: ${error.message}`);
        }
    }

    // Test connection
    async testConnection() {
        try {
            const balance = await this.stripe.balance.retrieve();

            return {
                success: true,
                message: 'Stripe connection successful',
                balance: balance
            };

        } catch (error) {
            console.error('Stripe connection test error:', error);
            return {
                success: false,
                message: `Stripe connection failed: ${error.message}`
            };
        }
    }

    // Get publishable key
    getPublishableKey() {
        return this.publishableKey;
    }
}

export default new StripeService(); 
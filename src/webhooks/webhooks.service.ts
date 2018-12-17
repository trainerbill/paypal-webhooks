import { Injectable, OnModuleInit, Request } from '@nestjs/common';
import * as request from 'superagent';
import supertest = require('supertest');

export interface IToken {
    scope: string;
    nonce: string;
    token_type: string;
    access_token: string;
    app_id: string;
    expires_in: number;
    expires_at: number;
}

@Injectable()
export class WebhooksService implements OnModuleInit {
    private clientId = process.env.PAYPAL_CLIENT_ID;
    private secret = process.env.PAYPAL_SECRET;
    private hostname = process.env.PAYPAL_ENV === 'live' ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com';
    private url = process.env.WEBHOOK_URL;
    private types: any[] = process.env.PAYPAL_EVENT_TYPES.split(',').map(name => ({ name }));
    private token: IToken;
    private webhooks: any[] = [];
    private webhook: any;

    constructor() {}

    async onModuleInit() {
        try {
            await this.setAccessToken();
            const webhooks = await this.list();
            this.webhooks = webhooks.body.webhooks;
            const webhook = this.webhooks.filter(wh => wh.url === this.url);
            if (webhook.length < 1) {
                const response = await this.create({
                    url: this.url,
                    event_types: this.types,
                });
                this.webhook = response.body;
            } else {
                this.webhook = webhook[0];
                // Update the webhook with new event types every time.  I don't see an issue with doing this.
                try {
                    await this.update(this.webhook.id, [{
                        op: 'replace',
                        path: '/event_types',
                        value: this.types,
                    }]);
                }
                catch (err) {
                    if (err.response.body.name !== 'WEBHOOK_PATCH_REQUEST_NO_CHANGE') {
                        throw err;
                    }
                }
            }
            return;
        } catch (err) {
            throw err;
        }

    }

    async setAccessToken() {
        try {
            const response = await request
                .post(`${this.hostname}/v1/oauth2/token`)
                .set('Authorization', 'Basic ' + Buffer.from(`${this.clientId}:${this.secret}`).toString('base64'))
                .set('Accept', 'application/json')
                .set('Accept-Language', 'en_US')
                .send('grant_type=client_credentials');
            response.body.expires_at = Date.now() + response.body.expires_in;
            this.token = response.body;
        } catch (err) {
            throw (err);
        }
    }

    async list() {
        if (Date.now() > this.token.expires_at) {
            await this.setAccessToken();
        }
        return await request
            .get(`${this.hostname}/v1/notifications/webhooks`)
            .set('Authorization', 'Bearer ' + this.token.access_token)
            .send();
    }

    async create(data: any) {
        if (Date.now() > this.token.expires_at) {
            await this.setAccessToken();
        }
        return await request
            .post(`${this.hostname}/v1/notifications/webhooks`)
            .set('Authorization', 'Bearer ' + this.token.access_token)
            .set('Accept', 'application/json')
            .send(data);
    }

    async update(id: string, data: any) {
        if (Date.now() > this.token.expires_at) {
            await this.setAccessToken();
        }
        return await request
            .patch(`${this.hostname}/v1/notifications/webhooks/${this.webhook.id}`)
            .set('Authorization', 'Bearer ' + this.token.access_token)
            .set('Accept', 'application/json')
            .send(data);
    }

    async verify(req: Request) {
        return await request
            .patch(`${this.hostname}/v1/notifications/verify-webhook-signature`)
            .set('Authorization', 'Bearer ' + this.token.access_token)
            .set('Accept', 'application/json')
            .send({
                auth_algo: req.headers['paypal-auth-algo'],
                cert_url: req.headers['paypal-cert-url'],
                transmission_id: req.headers['paypal-transmission-id'],
                transmission_sig: req.headers['paypal-transmission_sig'],
                transmission_time: req.headers['paypal-transmission-time'],
                webhook_id: this.webhook.id,
                webhook_event: req.body,
            });
    }
}
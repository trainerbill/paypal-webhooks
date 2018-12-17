import { Controller, Post, Req } from '@nestjs/common';
import * as paypal from 'paypal-rest-sdk';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
    constructor(
        private webhooksService: WebhooksService,
    ) {}

    @Post('/')
    async webhook(@Req() req) {
        const response = await this.webhooksService.verify(req);
        return;
    }
}

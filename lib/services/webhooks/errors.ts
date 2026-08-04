export class WebhookEndpointNotFoundError extends Error {
  constructor(id: string) {
    super(`Webhook endpoint ${id} not found.`);
    this.name = "WebhookEndpointNotFoundError";
  }
}

export class NotificationProviderNotConnectedError extends Error {
  constructor(providerId: string) {
    super(`Notification provider "${providerId}" is not connected and enabled — connect it in Settings → Integrations first.`);
    this.name = "NotificationProviderNotConnectedError";
  }
}

export class NotificationProviderError extends Error {
  constructor(providerId: string, message: string) {
    super(`Notification provider "${providerId}" error: ${message}`);
    this.name = "NotificationProviderError";
  }
}

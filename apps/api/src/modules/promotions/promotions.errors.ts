export class PromotionDomainError extends Error {
  constructor(
    readonly code:
      | 'promotion.validation_failed'
      | 'promotion.not_found'
      | 'promotion.version_conflict'
      | 'promotion.code_invalid'
      | 'promotion.not_eligible'
      | 'promotion.limit_reached'
      | 'promotion.invalid_state'
      | 'promotion.currency_mismatch',
    message: string,
  ) {
    super(message);
    this.name = 'PromotionDomainError';
  }
}

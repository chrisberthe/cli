import {
  CreditCardPaymentsAppExtensionConfigType,
  CreditCardPaymentsAppExtensionSchema,
  creditCardPaymentsAppExtensionDeployConfig,
  MAX_CHECKOUT_PAYMENT_METHOD_FIELDS,
} from './credit_card_payments_app_extension_schema.js'
import {buildCheckoutPaymentMethodFields} from './payments_app_extension_test_helper.js'
import {describe, expect, test} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

const config: CreditCardPaymentsAppExtensionConfigType = {
  name: 'test extension',
  type: 'payments_extension',
  payment_session_url: 'http://foo.bar',
  refund_session_url: 'http://foo.bar',
  capture_session_url: 'http://foo.bar',
  void_session_url: 'http://foo.bar',
  verification_session_url: 'http://foo.bar',
  confirmation_callback_url: 'http://foo.bar',
  merchant_label: 'some-label',
  supported_countries: ['CA'],
  supported_payment_methods: ['PAYMENT_METHOD'],
  supported_buyer_contexts: [{currency: 'USD'}, {currency: 'CAD'}],
  supports_moto: true,
  supports_3ds: false,
  test_mode_available: true,
  supports_deferred_payments: false,
  multiple_capture: false,
  supports_installments: false,
  targeting: [{target: 'payments.credit-card.render'}],
  api_version: '2022-07',
  description: 'my payments app extension',
  ui_extension_handle: 'sample-ui-extension',
  encryption_certificate_fingerprint: 'fingerprint',
  checkout_payment_method_fields: [{type: 'string', required: false, key: 'sample_key'}],
  input: {
    metafield_identifiers: {
      namespace: 'namespace',
      key: 'key',
    },
  },
}

describe('CreditCardPaymentsAppExtensionSchema', () => {
  test('validates a configuration with valid fields', async () => {
    // When
    const {success} = CreditCardPaymentsAppExtensionSchema.safeParse(config)

    // Then
    expect(success).toBe(true)
  })

  test('returns an error if no target is provided', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        targeting: [{...config.targeting[0]!, target: null}],
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          received: null,
          code: zod.ZodIssueCode.invalid_literal,
          expected: 'payments.credit-card.render',
          path: ['targeting', 0, 'target'],
          message: 'Invalid literal value, expected "payments.credit-card.render"',
        },
      ]),
    )
  })

  test('returns an error if no confirmation_callback_url is provided with supports 3ds', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        supports_3ds: true,
        confirmation_callback_url: undefined,
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          message: 'Property required when supports_3ds is true',
          path: ['confirmation_callback_url'],
        },
      ]),
    )
  })

  test('returns an error if encryption certificate fingerprint is not present', async () => {
    // When/Then
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const {encryption_certificate_fingerprint, ...rest} = config
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...rest,
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['encryption_certificate_fingerprint'],
          message: 'Required',
        },
      ]),
    )
  })

  test('returns an error if supports_installments does not match supports_deferred_payments', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        supports_installments: true,
        supports_deferred_payments: false,
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          message: 'supports_installments and supports_deferred_payments must be the same',
          path: [],
        },
      ]),
    )
  })

  test('returns an error if checkout_payment_method_fields has too many fields', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        checkout_payment_method_fields: buildCheckoutPaymentMethodFields(MAX_CHECKOUT_PAYMENT_METHOD_FIELDS + 1),
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.too_big,
          maximum: MAX_CHECKOUT_PAYMENT_METHOD_FIELDS,
          type: 'array',
          inclusive: true,
          exact: false,
          message: `The extension can't have more than ${MAX_CHECKOUT_PAYMENT_METHOD_FIELDS} checkout_payment_method_fields`,
          path: ['checkout_payment_method_fields'],
        },
      ]),
    )
  })

  test('returns an error if supports_moto is not a boolean', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        supports_moto: 'true',
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: 'invalid_type',
          expected: 'boolean',
          received: 'string',
          path: ['supports_moto'],
          message: 'Value must be Boolean',
        },
      ]),
    )
  })

  test('returns an error if supports_moto is not present', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        supports_moto: undefined,
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: 'invalid_type',
          expected: 'boolean',
          received: 'undefined',
          path: ['supports_moto'],
          message: 'supports_moto is required',
        },
      ]),
    )
  })
})

describe('creditCardPaymentsAppExtensionDeployConfig', () => {
  test('maps deploy configuration from extension configuration', async () => {
    // When
    const result = await creditCardPaymentsAppExtensionDeployConfig(config)

    // Then
    expect(result).toMatchObject({
      api_version: config.api_version,
      start_payment_session_url: config.payment_session_url,
      start_refund_session_url: config.refund_session_url,
      start_capture_session_url: config.capture_session_url,
      start_void_session_url: config.void_session_url,
      start_verification_session_url: config.verification_session_url,
      confirmation_callback_url: config.confirmation_callback_url,
      merchant_label: config.merchant_label,
      multiple_capture: config.multiple_capture,
      supported_countries: config.supported_countries,
      supported_payment_methods: config.supported_payment_methods,
      supported_buyer_contexts: config.supported_buyer_contexts,
      test_mode_available: config.test_mode_available,
      supports_moto: config.supports_moto,
      supports_3ds: config.supports_3ds,
      supports_deferred_payments: config.supports_deferred_payments,
      supports_installments: config.supports_installments,
      checkout_payment_method_fields: config.checkout_payment_method_fields,
      ui_extension_handle: config.ui_extension_handle,
      encryption_certificate_fingerprint: config.encryption_certificate_fingerprint,
    })
  })
})

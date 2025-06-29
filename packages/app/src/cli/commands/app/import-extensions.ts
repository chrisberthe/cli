import {buildTomlObject as buildPaymentsTomlObject} from '../../services/payments/extension-to-toml.js'
import {buildTomlObject as buildFlowTomlObject} from '../../services/flow/extension-to-toml.js'
import {buildTomlObject as buildAdminLinkTomlObject} from '../../services/admin-link/extension-to-toml.js'
import {buildTomlObject as buildMarketingActivityTomlObject} from '../../services/marketing_activity/extension-to-toml.js'
import {buildTomlObject as buildSubscriptionLinkTomlObject} from '../../services/subscription_link/extension-to-toml.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {appFlags} from '../../flags.js'
import {importExtensions} from '../../services/import-extensions.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {CurrentAppConfiguration} from '../../models/app/app.js'
import {renderSelectPrompt, renderFatalError} from '@shopify/cli-kit/node/ui'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'

interface MigrationChoice {
  label: string
  value: string
  extensionTypes: string[]
  buildTomlObject: (
    ext: ExtensionRegistration,
    allExtensions: ExtensionRegistration[],
    appConfiguration: CurrentAppConfiguration,
  ) => string
}

const getMigrationChoices = (): MigrationChoice[] => [
  {
    label: 'Payments Extensions',
    value: 'payments',
    extensionTypes: [
      'payments_app',
      'payments_app_credit_card',
      'payments_app_custom_credit_card',
      'payments_app_custom_onsite',
      'payments_app_redeemable',
      'payments_extension',
    ],
    buildTomlObject: buildPaymentsTomlObject,
  },
  {
    label: 'Flow Extensions',
    value: 'flow',
    extensionTypes: ['flow_action_definition', 'flow_trigger_definition', 'flow_trigger_discovery_webhook'],
    buildTomlObject: buildFlowTomlObject,
  },
  {
    label: 'Marketing Activity Extensions',
    value: 'marketing activity',
    extensionTypes: ['marketing_activity_extension'],
    buildTomlObject: buildMarketingActivityTomlObject,
  },
  {
    label: 'Subscription Link Extensions',
    value: 'subscription link',
    extensionTypes: ['subscription_link', 'subscription_link_extension'],
    buildTomlObject: buildSubscriptionLinkTomlObject,
  },
  {
    label: 'Admin Link extensions',
    value: 'link extension',
    extensionTypes: ['app_link', 'bulk_action'],
    buildTomlObject: buildAdminLinkTomlObject,
  },
]

export default class ImportExtensions extends AppLinkedCommand {
  static description = 'Import dashboard-managed extensions into your app.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID of your app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(ImportExtensions)
    const appContext = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const migrationChoices = getMigrationChoices()
    const choices = migrationChoices.map((choice) => {
      return {label: choice.label, value: choice.value}
    })
    const promptAnswer = await renderSelectPrompt({message: 'Extension type to migrate', choices})
    const migrationChoice = migrationChoices.find((choice) => choice.value === promptAnswer)
    if (migrationChoice === undefined) {
      renderFatalError(new AbortError('Invalid migration choice'))
      process.exit(1)
    }

    await importExtensions({
      ...appContext,
      extensionTypes: migrationChoice.extensionTypes,
      buildTomlObject: migrationChoice.buildTomlObject,
    })

    return {app: appContext.app}
  }
}

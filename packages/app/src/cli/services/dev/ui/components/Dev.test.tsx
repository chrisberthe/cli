import {calculatePrefixColumnSize, Dev} from './Dev.js'
import {testDeveloperPlatformClient, testUIExtension} from '../../../../models/app/app.test-data.js'
import {
  getLastFrameAfterUnmount,
  render,
  sendInputAndWait,
  sendInputAndWaitForContent,
  Stdin,
  waitForContent,
  waitForInputsToBeReady,
} from '@shopify/cli-kit/node/testing/ui'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import React from 'react'
import {describe, expect, test, vi} from 'vitest'
import {unstyled} from '@shopify/cli-kit/node/output'
import {openURL, sleep} from '@shopify/cli-kit/node/system'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/system', async () => {
  const actual: any = await vi.importActual('@shopify/cli-kit/node/system')
  return {
    ...actual,
    openURL: vi.fn(),
  }
})

vi.mock('../../../context.js')
vi.mock('../../fetch.js')
vi.mock('../../processes/dev-session.js')

const developerPlatformClient = testDeveloperPlatformClient()

const testApp = {
  canEnablePreviewMode: true,
  developmentStorePreviewEnabled: false,
  apiKey: '123',
  id: '123',
  developerPlatformClient,
  extensions: [],
}

const developerPreview = {
  fetchMode: vi.fn(async () => true),
  enable: vi.fn(async () => true),
  disable: vi.fn(async () => {}),
  update: vi.fn(async (_state: boolean) => true),
}

describe('Dev', () => {
  test('renders a stream of concurrent outputs from sub-processes, shortcuts and a preview url', async () => {
    // Given
    let backendPromiseResolve: () => void
    let frontendPromiseResolve: () => void

    const backendPromise = new Promise<void>(function (resolve, _reject) {
      backendPromiseResolve = resolve
    })

    const frontendPromise = new Promise<void>(function (resolve, _reject) {
      frontendPromiseResolve = resolve
    })

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        backendPromiseResolve()
      },
    }

    const frontendProcess = {
      prefix: 'frontend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        await backendPromise

        stdout.write('first frontend message')
        stdout.write('second frontend message')
        stdout.write('third frontend message')

        frontendPromiseResolve()
      },
    }
    // When

    const renderInstance = render(
      <Dev
        processes={[backendProcess, frontendProcess]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    await frontendPromise

    // Then
    expect(unstyled(renderInstance.lastFrame()!.replace(/\d/g, '0'))).toMatchInlineSnapshot(`
      "00:00:00 │  backend │ first backend message
      00:00:00 │  backend │ second backend message
      00:00:00 │  backend │ third backend message
      00:00:00 │ frontend │ first frontend message
      00:00:00 │ frontend │ second frontend message
      00:00:00 │ frontend │ third frontend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ toggle development store preview: ✔ on
      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      GraphiQL URL: http://localhost:0000/graphiql
      "
    `)

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test("doesn't render shortcuts if the stdin is not a TTY", async () => {
    // Given
    let backendPromiseResolve: () => void
    let frontendPromiseResolve: () => void

    const backendPromise = new Promise<void>(function (resolve, _reject) {
      backendPromiseResolve = resolve
    })

    const frontendPromise = new Promise<void>(function (resolve, _reject) {
      frontendPromiseResolve = resolve
    })

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        backendPromiseResolve()
      },
    }

    const frontendProcess = {
      prefix: 'frontend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        await backendPromise

        stdout.write('first frontend message')
        stdout.write('second frontend message')
        stdout.write('third frontend message')

        frontendPromiseResolve()

        // await promise that never resolves
        await new Promise(() => {})
      },
    }
    // When

    const renderInstance = render(
      <Dev
        processes={[backendProcess, frontendProcess]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
      {stdin: new Stdin({isTTY: false})},
    )

    await frontendPromise

    // Then
    expect(unstyled(renderInstance.lastFrame()!.replace(/\d/g, '0'))).toMatchInlineSnapshot(`
      "00:00:00 │  backend │ first backend message
      00:00:00 │  backend │ second backend message
      00:00:00 │  backend │ third backend message
      00:00:00 │ frontend │ first frontend message
      00:00:00 │ frontend │ second frontend message
      00:00:00 │ frontend │ third frontend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      Preview URL: https://shopify.com
      GraphiQL URL: http://localhost:0000/graphiql
      "
    `)

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('opens the previewUrl when p is pressed', async () => {
    // When
    const renderInstance = render(
      <Dev
        processes={[]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 100, 'p')
    // Then
    expect(vi.mocked(openURL)).toHaveBeenNthCalledWith(1, 'https://shopify.com')

    renderInstance.unmount()
  })

  test('quits when q is pressed', async () => {
    // Given
    const abortController = new AbortController()
    const abort = vi.spyOn(abortController, 'abort')

    // When
    const renderInstance = render(
      <Dev
        processes={[]}
        abortController={abortController}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    const promise = renderInstance.waitUntilExit()

    await waitForInputsToBeReady()
    renderInstance.stdin.write('q')

    await promise
    // Then
    expect(abort).toHaveBeenCalledOnce()
  })

  test('quits when ctrl+c is pressed', async () => {
    // Given
    const abortController = new AbortController()
    const abort = vi.spyOn(abortController, 'abort')

    // When
    const renderInstance = render(
      <Dev
        processes={[]}
        abortController={abortController}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    const promise = renderInstance.waitUntilExit()

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 100, '\u0003')

    await promise
    // Then
    expect(abort).toHaveBeenCalledOnce()

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('abortController can be used to exit from outside and should preserve static output', async () => {
    // Given
    const abortController = new AbortController()

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        // await promise that never resolves
        await new Promise(() => {})
      },
    }

    // When

    const renderInstance = render(
      <Dev
        processes={[backendProcess]}
        abortController={abortController}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    const promise = renderInstance.waitUntilExit()

    abortController.abort()

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ toggle development store preview: ✔ on
      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Shutting down dev ...
      "
    `)

    await promise

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message
      "
    `)
    expect(developerPreview.disable).toHaveBeenCalledOnce()

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('abortController can be used to exit with an error', async () => {
    // Given
    const abortController = new AbortController()

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        // await promise that never resolves
        await new Promise(() => {})
      },
    }

    // When

    const renderInstance = render(
      <Dev
        processes={[backendProcess]}
        abortController={abortController}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    const promise = renderInstance.waitUntilExit()

    abortController.abort('something went wrong')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ toggle development store preview: ✔ on
      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Shutting down dev because of an error ...
      "
    `)

    await promise

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message
      "
    `)
    expect(developerPreview.disable).toHaveBeenCalledOnce()

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('accepts inputs when the processes resolve', async () => {
    // Given
    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')
      },
    }

    // When
    const renderInstance = render(
      <Dev
        processes={[backendProcess]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    await waitForContent(renderInstance, 'Preview URL')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ toggle development store preview: ✔ on
      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      GraphiQL URL: http://localhost:0000/graphiql
      "
    `)

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 100, 'p')
    expect(vi.mocked(openURL)).toHaveBeenNthCalledWith(1, 'https://shopify.com')

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('when a process throws an error it calls abort on the abortController', async () => {
    // Given
    const backendProcess = {
      prefix: 'backend',
      action: async (_stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        throw new Error('something went wrong')
      },
    }

    const abortController = new AbortController()
    const abort = vi.spyOn(abortController, 'abort')

    // When
    const renderInstance = render(
      <Dev
        processes={[backendProcess]}
        abortController={abortController}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    await expect(renderInstance.waitUntilExit()).rejects.toThrow('something went wrong')
    expect(abort).toHaveBeenNthCalledWith(1, new Error('something went wrong'))

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('polls for preview mode', async () => {
    // Given
    vi.mocked(developerPreview.fetchMode).mockReset()
    vi.mocked(developerPreview.enable).mockReset()
    vi.mocked(developerPreview.fetchMode).mockResolvedValue(true)

    // When
    const renderInstance = render(
      <Dev
        processes={[]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        // Set a very short polling time for tests
        pollingTime={10}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    // Then
    // Wait long enough for multiple polling cycles
    await sleep(0.1)

    // enable should be called once at startup
    expect(developerPreview.enable).toHaveBeenCalledTimes(1)
    // fetchMode should be called multiple times due to polling
    expect(developerPreview.fetchMode.mock.calls.length).toBeGreaterThanOrEqual(2)

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test("doesn't poll for preview mode when the app does not support it", async () => {
    // Given
    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')
      },
    }

    vi.mocked(developerPreview.fetchMode).mockReset()
    vi.mocked(developerPreview.fetchMode).mockResolvedValue(true)
    vi.mocked(developerPreview.enable).mockReset()

    // When
    const renderInstance = render(
      <Dev
        processes={[backendProcess]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={{
          ...testApp,
          canEnablePreviewMode: false,
        }}
        // Set a very short polling time for tests
        pollingTime={10}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    // Then
    // Wait long enough for multiple polling cycles
    await sleep(0.1)
    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      GraphiQL URL: http://localhost:0000/graphiql
      "
    `)
    expect(developerPreview.enable).not.toHaveBeenCalled()
    expect(developerPreview.fetchMode).not.toHaveBeenCalled()

    // Verify 'd' input doesn't trigger update when app doesn't support preview
    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 100, 'd')
    expect(developerPreview.update).not.toHaveBeenCalled()

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('shows an error message when polling for preview mode fails', async () => {
    vi.mocked(developerPreview.fetchMode).mockReset()
    vi.mocked(developerPreview.fetchMode).mockRejectedValue(new Error('fail'))

    // When
    const renderInstance = render(
      <Dev
        processes={[]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        pollingTime={10}
        shopFqdn="mystore.shopify.io"
      />,
    )

    await waitForInputsToBeReady()

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d\d:\d\d:\d\d/g, '00:00:00')).toMatchInlineSnapshot(`
      "
      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ toggle development store preview: ✔ on
      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      GraphiQL URL: http://localhost:1234/graphiql
      Failed to fetch the latest status of the development store preview, trying again in 5 seconds.
      "
    `)

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('enables preview mode when pressing d', async () => {
    // Given
    vi.mocked(developerPreview.update).mockResolvedValueOnce(true)

    const renderInstance = render(
      <Dev
        processes={[]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    await waitForInputsToBeReady()

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "
      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ toggle development store preview: ✔ on
      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      GraphiQL URL: http://localhost:0000/graphiql
      "
    `)

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 100, 'd')
    expect(developerPreview.update).toHaveBeenCalledOnce()

    await waitForContent(renderInstance, 'off')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "
      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ toggle development store preview: ✖ off
      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      GraphiQL URL: http://localhost:0000/graphiql
      "
    `)

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test("shows an error message if enabling preview mode by pressing d doesn't succeed", async () => {
    // Given
    vi.mocked(developerPreview.update).mockResolvedValueOnce(false)

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')
      },
    }

    const renderInstance = render(
      <Dev
        processes={[backendProcess]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForContent(renderInstance, 'Failed to turn off development store preview.', 'd')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ toggle development store preview: ✔ on
      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      GraphiQL URL: http://localhost:0000/graphiql
      Failed to turn off development store preview.
      "
    `)

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('shows an error message if enabling preview mode by pressing d throws an exception', async () => {
    // Given
    vi.mocked(developerPreview.update).mockRejectedValueOnce(new Error('something went wrong'))

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')
      },
    }

    const renderInstance = render(
      <Dev
        processes={[backendProcess]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForContent(renderInstance, 'Failed to turn off development store preview.', 'd')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ toggle development store preview: ✔ on
      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      GraphiQL URL: http://localhost:0000/graphiql
      Failed to turn off development store preview.
      "
    `)

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('enables preview mode at startup', async () => {
    // Given
    const renderInstance = render(
      <Dev
        processes={[]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    await waitForInputsToBeReady()

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "
      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ toggle development store preview: ✔ on
      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      GraphiQL URL: http://localhost:0000/graphiql
      "
    `)

    await waitForInputsToBeReady()

    expect(developerPreview.enable).toHaveBeenCalledOnce()

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('shows an error message if enabling preview mode at startup fails', async () => {
    // Given
    vi.mocked(developerPreview.enable).mockRejectedValueOnce(new Error('something went wrong'))

    const renderInstance = render(
      <Dev
        processes={[]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    await waitForContent(renderInstance, 'Failed to turn on development store preview automatically.')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "
      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ toggle development store preview: ✖ off
      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      GraphiQL URL: http://localhost:0000/graphiql
      Failed to turn on development store preview automatically.
      Try turning it on manually by pressing \`d\`.
      "
    `)

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('shows an error if handling input throws an error', async () => {
    vi.mocked(openURL).mockRejectedValueOnce(new Error('something went wrong'))

    const renderInstance = render(
      <Dev
        processes={[]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        graphiqlUrl="https://graphiql.shopify.com"
        graphiqlPort={1234}
        app={testApp}
        developerPreview={developerPreview}
        shopFqdn="mystore.shopify.io"
      />,
    )

    await waitForInputsToBeReady()

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "
      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ toggle development store preview: ✔ on
      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      GraphiQL URL: http://localhost:0000/graphiql
      "
    `)

    await waitForInputsToBeReady()
    await sendInputAndWaitForContent(renderInstance, 'Failed to handle your input.', 'p')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "
      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ toggle development store preview: ✔ on
      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      GraphiQL URL: http://localhost:0000/graphiql
      Failed to handle your input.
      "
    `)

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })
})

describe('calculatePrefixColumnSize', () => {
  test('returns max size of processes and extensions', async () => {
    // Given
    const processes = [
      {prefix: '1', action: async () => {}},
      {prefix: '12', action: async () => {}},
      {prefix: '123', action: async () => {}},
    ]
    const extensions = [
      await testUIExtension({configuration: {name: 'Extension 1', handle: '1234', type: 'ui_extension'}}),
      await testUIExtension({configuration: {name: 'Extension 2', handle: '12345', type: 'ui_extension'}}),
      await testUIExtension({configuration: {name: 'Extension 3', handle: '123456', type: 'ui_extension'}}),
    ]

    // When
    const result = calculatePrefixColumnSize(processes, extensions)

    // Then
    expect(result).toBe(6)
  })
})

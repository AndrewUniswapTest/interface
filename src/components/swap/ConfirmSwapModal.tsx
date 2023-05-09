import { t, Trans } from '@lingui/macro'
import { sendAnalyticsEvent, Trace, useTrace } from '@uniswap/analytics'
import { InterfaceEventName, InterfaceModalName } from '@uniswap/analytics-events'
import { Trade } from '@uniswap/router-sdk'
import { Currency, Percent, TradeType } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import CurrencyLogo from 'components/Logo/CurrencyLogo'
import { useMaxAmountIn } from 'hooks/useMaxAmountIn'
import { Allowance, AllowanceState } from 'hooks/usePermit2Allowance'
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { InterfaceTrade } from 'state/routing/types'
import invariant from 'tiny-invariant'
import { tradeMeaningfullyDiffers } from 'utils/tradeMeaningFullyDiffer'

import TransactionConfirmationModal, {
  ConfirmationModalContent,
  TransactionErrorContent,
} from '../TransactionConfirmationModal'
import { PendingModalContent } from './PendingModalContent'
import SwapModalFooter from './SwapModalFooter'
import SwapModalHeader from './SwapModalHeader'

enum SummaryModalState {
  REVIEWING,
  ALLOWING,
  PENDING_CONFIRMATION,
}

export default function ConfirmSwapModal({
  trade,
  originalTrade,
  onAcceptChanges,
  allowedSlippage,
  allowance,
  onConfirm,
  onDismiss,
  swapErrorMessage,
  isOpen,
  attemptingTxn,
  txHash,
  swapQuoteReceivedDate,
  fiatValueInput,
  fiatValueOutput,
}: {
  isOpen: boolean
  trade: InterfaceTrade<Currency, Currency, TradeType> | undefined
  originalTrade: Trade<Currency, Currency, TradeType> | undefined
  attemptingTxn: boolean
  txHash: string | undefined
  allowedSlippage: Percent
  allowance: Allowance
  onAcceptChanges: () => void
  onConfirm: () => void
  swapErrorMessage: ReactNode | undefined
  onDismiss: () => void
  swapQuoteReceivedDate: Date | undefined
  fiatValueInput: { data?: number; isLoading: boolean }
  fiatValueOutput: { data?: number; isLoading: boolean }
}) {
  // shouldLogModalCloseEvent lets the child SwapModalHeader component know when modal has been closed
  // and an event triggered by modal closing should be logged.
  const [shouldLogModalCloseEvent, setShouldLogModalCloseEvent] = useState(false)
  const showAcceptChanges = useMemo(
    () => Boolean(trade && originalTrade && tradeMeaningfullyDiffers(trade, originalTrade)),
    [originalTrade, trade]
  )

  const [confirmModalState, setConfirmModalState] = useState<SummaryModalState>(SummaryModalState.REVIEWING)

  const { chainId } = useWeb3React()
  const trace = useTrace()
  const maximumAmountIn = useMaxAmountIn(trade, allowedSlippage)

  useEffect(() => {
    if (confirmModalState === SummaryModalState.ALLOWING && allowance.state === AllowanceState.ALLOWED) {
      onConfirm()
      setConfirmModalState(SummaryModalState.PENDING_CONFIRMATION)
    }
  }, [allowance.state, confirmModalState, onConfirm])

  const updateAllowance = useCallback(async () => {
    invariant(allowance.state === AllowanceState.REQUIRED)
    setConfirmModalState(SummaryModalState.ALLOWING)
    try {
      await allowance.approveAndPermit()
      sendAnalyticsEvent(InterfaceEventName.APPROVE_TOKEN_TXN_SUBMITTED, {
        chain_id: chainId,
        token_symbol: maximumAmountIn?.currency.symbol,
        token_address: maximumAmountIn?.currency.address,
        ...trace,
      })
    } catch (e) {
      console.error(e)
      // todo: if user rejected, just revert to summary view
      // if there was another unknow error, render error content in modal
      return false
    }
    return true
  }, [allowance, chainId, maximumAmountIn?.currency.address, maximumAmountIn?.currency.symbol, trace])

  const onModalDismiss = useCallback(() => {
    if (isOpen) setShouldLogModalCloseEvent(true)
    onDismiss()
    setConfirmModalState(SummaryModalState.REVIEWING)
  }, [isOpen, onDismiss])

  const modalHeader = useCallback(() => {
    if (confirmModalState !== SummaryModalState.REVIEWING && !showAcceptChanges) {
      return null
    }
    if (!trade) {
      return null
    }
    return <SwapModalHeader trade={trade} allowedSlippage={allowedSlippage} />
  }, [allowedSlippage, confirmModalState, showAcceptChanges, trade])

  const modalBottom = useCallback(() => {
    if (
      !showAcceptChanges &&
      confirmModalState === SummaryModalState.ALLOWING &&
      allowance.state === AllowanceState.REQUIRED &&
      allowance.needsPermit2Approval
    ) {
      return (
        <PendingModalContent
          title={t`Approve permit`}
          subtitle={t`Proceed in wallet`}
          label={t`Why are permits required?`}
          tooltipText={t`Permit2 allows token approvals to be shared and managed across different applications.`}
          logo={<CurrencyLogo currency={trade?.inputAmount?.currency} size="48px" />}
        />
      )
    }
    if (
      !showAcceptChanges &&
      confirmModalState === SummaryModalState.ALLOWING &&
      allowance.state === AllowanceState.REQUIRED &&
      allowance.needsSignature
    ) {
      return (
        <PendingModalContent
          title={t`Approve ${trade?.inputAmount?.currency?.symbol}`}
          subtitle={t`Proceed in wallet`}
          label={t`Why are approvals required?`}
          tooltipText={t`This provides the Uniswap protocol access to your token for trading. For security, this will expire after 30 days.`}
          logo={<CurrencyLogo currency={trade?.inputAmount?.currency} size="48px" />}
        />
      )
    }
    // todo: create a new pending state for SummaryModalState.PENDING_CONFIRMATION ?
    if (!trade) {
      return null
    }
    return (
      <SwapModalFooter
        onConfirm={async () => {
          if (allowance.state === AllowanceState.REQUIRED) {
            const allowanceResult: boolean = await updateAllowance()
            if (!allowanceResult) {
              setConfirmModalState(SummaryModalState.REVIEWING)
            }
          } else {
            onConfirm()
          }
        }}
        trade={trade}
        hash={txHash}
        allowedSlippage={allowedSlippage}
        disabledConfirm={showAcceptChanges}
        swapErrorMessage={swapErrorMessage}
        swapQuoteReceivedDate={swapQuoteReceivedDate}
        fiatValueInput={fiatValueInput}
        fiatValueOutput={fiatValueOutput}
        shouldLogModalCloseEvent={shouldLogModalCloseEvent}
        setShouldLogModalCloseEvent={setShouldLogModalCloseEvent}
        showAcceptChanges={showAcceptChanges}
        onAcceptChanges={() => {
          setConfirmModalState(SummaryModalState.REVIEWING)
          onAcceptChanges()
        }}
      />
    )
  }, [
    allowance,
    confirmModalState,
    trade,
    txHash,
    allowedSlippage,
    showAcceptChanges,
    swapErrorMessage,
    swapQuoteReceivedDate,
    fiatValueInput,
    fiatValueOutput,
    shouldLogModalCloseEvent,
    onAcceptChanges,
    updateAllowance,
    onConfirm,
  ])

  // text to show while loading
  const pendingText = (
    <Trans>
      Swapping {trade?.inputAmount?.toSignificant(6)} {trade?.inputAmount?.currency?.symbol} for{' '}
      {trade?.outputAmount?.toSignificant(6)} {trade?.outputAmount?.currency?.symbol}
    </Trans>
  )

  const confirmationContent = useCallback(
    () =>
      swapErrorMessage ? (
        <TransactionErrorContent onDismiss={onModalDismiss} message={swapErrorMessage} />
      ) : (
        <ConfirmationModalContent
          title={confirmModalState === SummaryModalState.REVIEWING ? <Trans>Review Swap</Trans> : undefined}
          onDismiss={onModalDismiss}
          topContent={modalHeader}
          bottomContent={modalBottom}
        />
      ),
    [swapErrorMessage, onModalDismiss, confirmModalState, modalHeader, modalBottom]
  )

  return (
    <Trace modal={InterfaceModalName.CONFIRM_SWAP}>
      <TransactionConfirmationModal
        isOpen={isOpen}
        onDismiss={onModalDismiss}
        attemptingTxn={attemptingTxn}
        hash={txHash}
        content={confirmationContent}
        pendingText={pendingText}
        currencyToAdd={trade?.outputAmount.currency}
      />
    </Trace>
  )
}

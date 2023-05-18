import { Trans } from '@lingui/macro'
import { formatNumber } from '@uniswap/conedison/format'
import { ButtonGray, ButtonPrimary } from 'components/Button'
import Loader from 'components/Icons/LoadingSpinner'
import { HandHoldingDollarIcon } from 'nft/components/icons'
import { useFetchSingleAsset } from 'nft/hooks/useFetchAssets'
import { GenieAsset } from 'nft/types'
import styled, { css } from 'styled-components/macro'

const ButtonStyles = css`
  width: min-content;
  flex-shrink: 0;
  border-radius: 16px;
`

const MakeOfferButtonSmall = styled(ButtonPrimary)`
  padding: 16px;
  ${ButtonStyles}
`

const MakeOfferButtonLarge = styled(ButtonGray)`
  white-space: nowrap;
  ${ButtonStyles}
`

const StyledBuyButton = styled(ButtonPrimary)`
  display: flex;
  flex-direction: row;
  padding: 16px 24px;
  gap: 8px;
  line-height: 24px;
  white-space: nowrap;

  ${ButtonStyles}
`

const Price = styled.div`
  color: ${({ theme }) => theme.accentTextLightSecondary};
`

export const BuyButton = ({ asset, onDataPage }: { asset: GenieAsset; onDataPage?: boolean }) => {
  const { fetchAndPurchaseSingleAsset, isLoading: isLoadingRoute } = useFetchSingleAsset()
  const price = asset.sellorders?.[0]?.price.value

  if (!price) {
    return (
      <MakeOfferButtonLarge>
        <Trans>Make an offer</Trans>
      </MakeOfferButtonLarge>
    )
  }

  return (
    <>
      <StyledBuyButton disabled={isLoadingRoute} onClick={() => fetchAndPurchaseSingleAsset(asset)}>
        {isLoadingRoute ? (
          <>
            <Trans>Fetching Route</Trans>
            <Loader size="24px" stroke="white" />
          </>
        ) : (
          <>
            <Trans>Buy</Trans>
            <Price>{formatNumber(price)} ETH</Price>
          </>
        )}
      </StyledBuyButton>
      {onDataPage && (
        <MakeOfferButtonSmall>
          <HandHoldingDollarIcon />
        </MakeOfferButtonSmall>
      )}
    </>
  )
}

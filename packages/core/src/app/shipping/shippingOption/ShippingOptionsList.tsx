import { ExtensionRegion, type ShippingOption } from '@bigcommerce/checkout-sdk/essential';
import React, { type FunctionComponent, memo, useCallback } from 'react';

import { useCheckout } from '@bigcommerce/checkout/contexts';
import { Extension } from '@bigcommerce/checkout/checkout-extension';
import { Checklist, ChecklistItem, LoadingOverlay } from '@bigcommerce/checkout/ui';

import { EMPTY_ARRAY } from '../../common/utility';

import StaticShippingOption from './StaticShippingOption';

interface ShippingOptionListItemProps {
    consignmentId: string;
    isMultiShippingMode: boolean;
    selectedShippingOptionId?: string;
    shippingOption: ShippingOption;
}

const ShippingOptionListItem: FunctionComponent<ShippingOptionListItemProps> = ({
    consignmentId,
    isMultiShippingMode,
    selectedShippingOptionId,
    shippingOption,
}) => {
    const isSelected = selectedShippingOptionId === shippingOption.id;

    const renderLabel = useCallback(
        () => (
            <div className="shippingOptionLabel">
                <StaticShippingOption
                    displayAdditionalInformation={true}
                    method={shippingOption}
                    shippingCostAfterDiscount={shippingOption.costAfterDiscount}
                />
                {isSelected && !isMultiShippingMode && (
                    <Extension region={ExtensionRegion.ShippingSelectedShippingMethod} />
                )}
            </div>
        ),
        [isSelected, isMultiShippingMode, shippingOption],
    );

    return (
        <ChecklistItem
            htmlId={`shippingOptionRadio-${consignmentId}-${shippingOption.id}`}
            label={renderLabel}
            value={shippingOption.id}
        />
    );
};

export interface ShippingOptionListProps {
    consignmentId: string;
    inputName: string;
    isLoading: boolean;
    isMultiShippingMode: boolean;
    selectedShippingOptionId?: string;
    shippingOptions?: ShippingOption[];
    onSelectedOption(consignmentId: string, shippingOptionId: string): void;
}

const ShippingOptionsList: FunctionComponent<ShippingOptionListProps> = ({
    consignmentId,
    inputName,
    isLoading,
    isMultiShippingMode,
    shippingOptions = EMPTY_ARRAY,
    selectedShippingOptionId,
    onSelectedOption,
}) => {
    const {
        selectedState: { customer },
    } = useCheckout(({ data }) => ({
        customer: data.getCustomer(),
    }));

    const handleSelect = useCallback(
        (value: string) => {
            onSelectedOption(consignmentId, value);
        },
        [consignmentId, onSelectedOption],
    );

    const visibleShippingOptions = customer?.isGuest
        ? shippingOptions.filter((shippingOption) => {
              const normalizedDescription = shippingOption.description?.toLowerCase() || '';

              return shippingOption.type !== 'freeshipping' && !normalizedDescription.includes('free shipping');
          })
        : shippingOptions;

    const preferredShippingOptionId =
        !selectedShippingOptionId && visibleShippingOptions.length
            ? visibleShippingOptions.find((shippingOption) => shippingOption.isRecommended)?.id ??
              visibleShippingOptions[0]?.id
            : selectedShippingOptionId;

    if (!visibleShippingOptions.length) {
        return null;
    }

    return (
        <LoadingOverlay isLoading={isLoading}>
            <Checklist
                aria-live="polite"
                defaultSelectedItemId={preferredShippingOptionId}
                name={inputName}
                onSelect={handleSelect}
            >
                {visibleShippingOptions.map((shippingOption) => (
                    <ShippingOptionListItem
                        consignmentId={consignmentId}
                        isMultiShippingMode={isMultiShippingMode}
                        key={shippingOption.id}
                        selectedShippingOptionId={selectedShippingOptionId}
                        shippingOption={shippingOption}
                    />
                ))}
            </Checklist>
        </LoadingOverlay>
    );
};

export default memo(ShippingOptionsList);

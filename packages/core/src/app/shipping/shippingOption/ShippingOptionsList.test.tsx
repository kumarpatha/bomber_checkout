import { Formik } from 'formik';
import React from 'react';

import { useCheckout } from '@bigcommerce/checkout/contexts';
import { render, screen } from '@bigcommerce/checkout/test-utils';

jest.mock('@bigcommerce/checkout/checkout-extension', () => ({
    Extension: () => null,
    ExtensionRegion: {
        ShippingSelectedShippingMethod: 'shipping-selected-shipping-method',
    },
}));

jest.mock('@bigcommerce/checkout/contexts', () => ({
    ...jest.requireActual('@bigcommerce/checkout/contexts'),
    useCheckout: jest.fn(),
}));

import ShippingOptionsList from './ShippingOptionsList';

describe('ShippingOptionsList', () => {
    beforeEach(() => {
        (useCheckout as jest.Mock).mockImplementation((selector) => ({
            selectedState: selector({
                data: {
                    getCustomer: () => ({ isGuest: true }),
                },
                statuses: {},
            }),
        }));
    });

    it('filters out free-shipping options for guests', () => {
        render(
            <Formik initialValues={{ shippingOptionIds: {} }} onSubmit={jest.fn()}>
                <ShippingOptionsList
                    consignmentId="consignment-1"
                    inputName="shippingOptionIds"
                    isLoading={false}
                    isMultiShippingMode={false}
                    onSelectedOption={jest.fn()}
                    shippingOptions={[
                        {
                            id: 'standard',
                            description: 'Standard',
                            cost: 5,
                            costAfterDiscount: 5,
                            type: 'shipping',
                            imageUrl: '',
                            transitTime: '',
                            isRecommended: false,
                            additionalDescription: '',
                        },
                        {
                            id: 'free',
                            description: 'Free Shipping',
                            cost: 0,
                            costAfterDiscount: 0,
                            type: 'freeshipping',
                            imageUrl: '',
                            transitTime: '',
                            isRecommended: true,
                            additionalDescription: '',
                        },
                    ]}
                    selectedShippingOptionId="standard"
                />
            </Formik>,
        );

        expect(screen.getByText('Standard')).toBeInTheDocument();
        expect(screen.queryByText('Free Shipping')).not.toBeInTheDocument();
    });

    it('shows free-shipping options for logged-in shoppers', () => {
        (useCheckout as jest.Mock).mockImplementation((selector) => ({
            selectedState: selector({
                data: {
                    getCustomer: () => ({ isGuest: false }),
                },
                statuses: {},
            }),
        }));

        render(
            <Formik initialValues={{ shippingOptionIds: {} }} onSubmit={jest.fn()}>
                <ShippingOptionsList
                    consignmentId="consignment-1"
                    inputName="shippingOptionIds"
                    isLoading={false}
                    isMultiShippingMode={false}
                    onSelectedOption={jest.fn()}
                    shippingOptions={[
                        {
                            id: 'standard',
                            description: 'Standard',
                            cost: 5,
                            costAfterDiscount: 5,
                            type: 'shipping',
                            imageUrl: '',
                            transitTime: '',
                            isRecommended: false,
                            additionalDescription: '',
                        },
                        {
                            id: 'free',
                            description: 'Free Shipping',
                            cost: 0,
                            costAfterDiscount: 0,
                            type: 'freeshipping',
                            imageUrl: '',
                            transitTime: '',
                            isRecommended: true,
                            additionalDescription: '',
                        },
                    ]}
                    selectedShippingOptionId=""
                />
            </Formik>,
        );

        expect(screen.getByText('Free Shipping')).toBeInTheDocument();
    });
});

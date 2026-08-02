import '@testing-library/jest-dom';

import {
    type Cart,
    type Checkout,
    type CheckoutSelectors,
    type CheckoutService,
    createCheckoutService,
    type StoreConfig,
} from '@bigcommerce/checkout-sdk';
import { faker } from '@faker-js/faker';
import userEvent from '@testing-library/user-event';
import React, { type FunctionComponent } from 'react';

import {
    AnalyticsProviderMock,
    CheckoutProvider,
    LocaleContext,
    type LocaleContextType,
} from '@bigcommerce/checkout/contexts';
import { createLocaleContext } from '@bigcommerce/checkout/locale';
import { getGuestCustomer } from '@bigcommerce/checkout/test-mocks';
import { render, screen } from '@bigcommerce/checkout/test-utils';

import { getCart } from '../cart/carts.mock';
import { getCheckout } from '../checkout/checkouts.mock';
import CheckoutStepType from '../checkout/CheckoutStepType';
import { getStoreConfig } from '../config/config.mock';

import Customer, { type CustomerProps } from './Customer';
import CustomerViewType from './CustomerViewType';

describe('Customer Guest', () => {
    let CustomerTest: FunctionComponent<CustomerProps>;
    let checkoutService: CheckoutService;
    let localeContext: LocaleContextType;
    let checkout: Checkout;
    let cart: Cart;
    let config: StoreConfig;
    const defaultProps = {
        isSubscribed: false,
        isWalletButtonsOnTop: false,
        onSubscribeToNewsletter: jest.fn(),
        step: {
            isActive: true,
            isBusy: false,
            isComplete: false,
            isEditable: true,
            isRequired: true,
            type: CheckoutStepType.Customer,
        },
    };

    beforeEach(() => {
        checkoutService = createCheckoutService();
        localeContext = createLocaleContext(getStoreConfig());
        checkout = getCheckout();
        cart = getCart();
        config = getStoreConfig();

        jest.spyOn(checkoutService.getState().data, 'getCheckout').mockReturnValue(checkout);

        jest.spyOn(checkoutService.getState().data, 'getCart').mockReturnValue(cart);

        jest.spyOn(checkoutService.getState().data, 'getConfig').mockReturnValue(config);

        jest.spyOn(checkoutService, 'loadPaymentMethods').mockResolvedValue(
            checkoutService.getState(),
        );

        jest.spyOn(checkoutService, 'initializeCustomer').mockResolvedValue(
            checkoutService.getState(),
        );

        jest.spyOn(checkoutService.getState().data, 'getPaymentMethods').mockReturnValue([]);

        CustomerTest = (props) => (
            <CheckoutProvider checkoutService={checkoutService}>
                <LocaleContext.Provider value={localeContext}>
                    <AnalyticsProviderMock>
                        <Customer {...props} />
                    </AnalyticsProviderMock>
                </LocaleContext.Provider>
            </CheckoutProvider>
        );
    });

    it('renders guest form and continues without the early email field', async () => {
        jest.spyOn(checkoutService, 'continueAsGuest').mockResolvedValue({} as CheckoutSelectors);

        render(<CustomerTest viewType={CustomerViewType.Guest} {...defaultProps} />);

        expect(screen.getByTestId('checkout-customer-guest')).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole('button', {
                name: localeContext.language.translate('customer.continue'),
            }),
        );

        expect(checkoutService.continueAsGuest).not.toHaveBeenCalled();
    });

    it('displays error message if email is not valid', async () => {
        jest.spyOn(checkoutService, 'continueAsGuest').mockResolvedValue({} as CheckoutSelectors);

        render(<CustomerTest viewType={CustomerViewType.Guest} {...defaultProps} />);

        expect(screen.getByTestId('checkout-customer-guest')).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole('button', {
                name: localeContext.language.translate('customer.continue'),
            }),
        );

        expect(checkoutService.continueAsGuest).not.toHaveBeenCalled();
    });

    it('displays marketing consent field if requiresMarketingConsent is set in config', async () => {
        jest.spyOn(checkoutService.getState().data, 'getConfig').mockReturnValue({
            ...config,
            checkoutSettings: {
                ...config.checkoutSettings,
                requiresMarketingConsent: true,
            },
        });
        jest.spyOn(checkoutService, 'continueAsGuest').mockResolvedValue({} as CheckoutSelectors);

        render(<CustomerTest viewType={CustomerViewType.Guest} {...defaultProps} />);

        expect(screen.getByTestId('checkout-customer-guest')).toBeInTheDocument();

        const subscribeCheckbox = screen.getByLabelText(
            localeContext.language.translate('customer.guest_marketing_consent'),
        );

        expect(subscribeCheckbox).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole('button', {
                name: localeContext.language.translate('customer.continue'),
            }),
        );

        expect(checkoutService.continueAsGuest).not.toHaveBeenCalled();
    });

    it('checks subscribe to news letter and continues without the early email field', async () => {
        jest.spyOn(checkoutService, 'continueAsGuest').mockResolvedValue({} as CheckoutSelectors);

        render(<CustomerTest viewType={CustomerViewType.Guest} {...defaultProps} />);

        const subscribeCheckbox = screen.getByLabelText(
            localeContext.language.translate('customer.guest_subscribe_to_newsletter_text'),
        );

        await userEvent.click(subscribeCheckbox);

        await userEvent.click(
            screen.getByRole('button', {
                name: localeContext.language.translate('customer.continue'),
            }),
        );

        expect(checkoutService.continueAsGuest).not.toHaveBeenCalled();
    });

    it('selects `Subscribe to our newsletter` checkbox by default', async () => {
        const props = { ...defaultProps, isSubscribed: true };

        render(<CustomerTest viewType={CustomerViewType.Guest} {...props} />);

        expect(screen.getByTestId('should-subscribe-checkbox')).toBeChecked();
    });

    it('displays error message if privacy policy is required and not checked', async () => {
        jest.spyOn(checkoutService.getState().data, 'getConfig').mockReturnValue({
            ...config,
            checkoutSettings: {
                ...config.checkoutSettings,
                privacyPolicyUrl: 'foo',
            },
        });
        jest.spyOn(checkoutService, 'continueAsGuest').mockResolvedValue({} as CheckoutSelectors);

        render(<CustomerTest viewType={CustomerViewType.Guest} {...defaultProps} />);

        expect(screen.getByTestId('checkout-customer-guest')).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole('button', {
                name: localeContext.language.translate('customer.continue'),
            }),
        );

        expect(
            screen.getByLabelText(
                localeContext.language.translate('privacy_policy.required_error'),
            ),
        ).toBeInTheDocument();

        expect(checkoutService.continueAsGuest).not.toHaveBeenCalled();

        const link = screen.getByText('privacy policy');

        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'foo');

        expect(screen.getByTestId('privacy-policy-checkbox')).toBeInTheDocument();
        await userEvent.click(screen.getByTestId('privacy-policy-checkbox'));

        await userEvent.click(
            screen.getByRole('button', {
                name: localeContext.language.translate('customer.continue'),
            }),
        );

        expect(checkoutService.continueAsGuest).not.toHaveBeenCalled();
    });

    it('calls onUnhandledError if initialize was failed', async () => {
        const error = new Error();

        jest.spyOn(checkoutService.getState().data, 'getConfig').mockReturnValue({
            ...config,
            checkoutSettings: {
                ...config.checkoutSettings,
                providerWithCustomCheckout: 'bolt',
            },
        });

        jest.spyOn(checkoutService, 'initializeCustomer').mockRejectedValue(error);

        const unhandledError = jest.fn();

        render(
            <CustomerTest
                {...defaultProps}
                onUnhandledError={unhandledError}
                viewType={CustomerViewType.Guest}
            />,
        );
        await new Promise((resolve) => process.nextTick(resolve));

        expect(unhandledError).toHaveBeenCalledWith(error);
    });

    it('calls onUnhandledError if deinitialize was failed', async () => {
        const error = new Error();

        jest.spyOn(checkoutService, 'deinitializeCustomer').mockRejectedValue(error);

        const unhandledError = jest.fn();

        const { unmount } = render(
            <CustomerTest
                {...defaultProps}
                onUnhandledError={unhandledError}
                viewType={CustomerViewType.Guest}
            />,
        );

        await new Promise((resolve) => process.nextTick(resolve));
        unmount();
        await new Promise((resolve) => process.nextTick(resolve));

        expect(unhandledError).toHaveBeenCalledWith(error);
    });

    it('triggers no error callback when the guest flow is continued without an early email', async () => {
        jest.spyOn(checkoutService, 'continueAsGuest').mockRejectedValue({
            type: 'unknown_error',
        });

        const handleError = jest.fn();

        render(
            <CustomerTest
                {...defaultProps}
                onContinueAsGuestError={handleError}
                viewType={CustomerViewType.Guest}
            />,
        );

        expect(screen.getByTestId('checkout-customer-guest')).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole('button', {
                name: localeContext.language.translate('customer.continue'),
            }),
        );

        expect(checkoutService.continueAsGuest).not.toHaveBeenCalled();
        expect(handleError).not.toHaveBeenCalled();
    });

    it('triggers completion callback if the guest flow continues without the early email field', async () => {
        const error = { type: 'update_subscriptions' };

        jest.spyOn(checkoutService, 'continueAsGuest').mockRejectedValue(error);

        const handleContinueAsGuest = jest.fn();

        render(
            <CustomerTest
                {...defaultProps}
                onContinueAsGuest={handleContinueAsGuest}
                viewType={CustomerViewType.Guest}
            />,
        );

        expect(screen.getByTestId('checkout-customer-guest')).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole('button', {
                name: localeContext.language.translate('customer.continue'),
            }),
        );

        expect(checkoutService.continueAsGuest).not.toHaveBeenCalled();

        expect(handleContinueAsGuest).toHaveBeenCalled();
    });

    it('continues without changing view type when no early email is provided and guest check returns 429', async () => {
        const onChangeViewType = jest.fn();

        jest.spyOn(checkoutService, 'continueAsGuest').mockRejectedValue({
            type: 'error',
            status: 429,
        });

        render(
            <CustomerTest
                onChangeViewType={onChangeViewType}
                viewType={CustomerViewType.Guest}
                {...defaultProps}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', {
                name: localeContext.language.translate('customer.continue'),
            }),
        );

        expect(checkoutService.continueAsGuest).not.toHaveBeenCalled();
        expect(onChangeViewType).not.toHaveBeenCalled();
    });

    it('continues without changing view type when no early email is provided and the guest response suggests sign-in', async () => {
        const onChangeViewType = jest.fn();

        jest.spyOn(checkoutService, 'continueAsGuest').mockResolvedValue({
            data: {
                getCustomer: () => ({
                    ...getGuestCustomer(),
                    shouldEncourageSignIn: true,
                }),
                getPaymentProviderCustomer: () => undefined,
            },
        } as CheckoutSelectors);

        render(
            <CustomerTest
                onChangeViewType={onChangeViewType}
                viewType={CustomerViewType.Guest}
                {...defaultProps}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', {
                name: localeContext.language.translate('customer.continue'),
            }),
        );

        expect(checkoutService.continueAsGuest).not.toHaveBeenCalled();
        expect(onChangeViewType).not.toHaveBeenCalled();
    });

    it('does not render SuggestedLogin form if Stripe link is authenticated', async () => {
        const onChangeViewType = jest.fn();

        jest.spyOn(checkoutService, 'continueAsGuest').mockResolvedValue({
            data: {
                getCustomer: () => ({
                    ...getGuestCustomer(),
                    shouldEncourageSignIn: true,
                }),
                getPaymentProviderCustomer: () => ({ stripeLinkAuthenticationState: true }),
            },
        } as CheckoutSelectors);

        render(
            <CustomerTest
                onChangeViewType={onChangeViewType}
                viewType={CustomerViewType.Guest}
                {...defaultProps}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', {
                name: localeContext.language.translate('customer.continue'),
            }),
        );

        expect(onChangeViewType).not.toHaveBeenCalled();
    });

    it('continues without changing view type when no early email is provided and guest check returns 403', async () => {
        const onChangeViewType = jest.fn();

        jest.spyOn(checkoutService, 'continueAsGuest').mockRejectedValue({
            type: 'error',
            status: 403,
        });

        render(
            <CustomerTest
                onChangeViewType={onChangeViewType}
                viewType={CustomerViewType.Guest}
                {...defaultProps}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', {
                name: localeContext.language.translate('customer.continue'),
            }),
        );

        expect(checkoutService.continueAsGuest).not.toHaveBeenCalled();
        expect(onChangeViewType).not.toHaveBeenCalled();
    });
});

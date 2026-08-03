import { type Address } from '@bigcommerce/checkout-sdk';
import type { FormField } from '@bigcommerce/checkout-sdk';
import { type FormikProps } from 'formik';
import { debounce, type DebouncedFunc, isEqual, noop } from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { lazy, object, string } from 'yup';

import { useCapabilities, useCheckout, useThemeContext } from '@bigcommerce/checkout/contexts';
import { TranslatedString, withLanguage, type WithLanguageProps } from '@bigcommerce/checkout/locale';
import { CheckboxFormField, Fieldset, Form } from '@bigcommerce/checkout/ui';

import {
    type AddressFormValues,
    decodeAddressLabel,
    getAddressFormFieldsValidationSchema,
    getTranslateAddressError,
    isEqualAddress,
    mapAddressFromFormValues,
    mapAddressToFormValues,
} from '../address';
import { isErrorWithType } from '../common/error';
import { withFormikExtended } from '../common/form';
import {
    getAddressExtraFieldsValidationSchema,
    getCustomFormFieldsValidationSchema,
} from '../formFields';
import { PaymentMethodId } from '../payment/paymentMethod';

import BillingSameAsShippingField from './BillingSameAsShippingField';
import hasSelectedShippingOptions from './hasSelectedShippingOptions';
import { useShipping } from './hooks/useShipping';
import isSelectedShippingOptionValid from './isSelectedShippingOptionValid';
import ShippingAddress from './ShippingAddress';
import { SHIPPING_ADDRESS_FIELDS } from './ShippingAddressFields';
import ShippingFormFooter from './ShippingFormFooter';

export interface SingleShippingFormProps {
    isBillingSameAsShipping: boolean;
    cartHasChanged: boolean;
    customerMessage: string;
    hasAddressLabel: boolean;
    methodId?: string;
    shippingAddress?: Address;
    shippingAutosaveDelay?: number;
    isInitialValueLoaded: boolean;
    shippingFormRenderTimestamp?: number;
    getFields(countryCode?: string): FormField[];
    onSignIn?(): void;
    onSubmit(values: SingleShippingFormValues): void;
    onUnhandledError?(error: Error): void;
}

interface AddressWithEmail extends Address {
    email?: string;
}

export interface SingleShippingFormValues {
    isGift: boolean;
    billingSameAsShipping: boolean;
    email?: string;
    shippingAddress?: AddressFormValues;
    orderComment: string;
}

function shouldHaveCustomValidation(methodId?: string): boolean {
    const methodIdsWithoutCustomValidation: string[] = [
        PaymentMethodId.BraintreeAcceleratedCheckout,
        PaymentMethodId.PayPalCommerceAcceleratedCheckout,
    ];

    return Boolean(methodId && !methodIdsWithoutCustomValidation.includes(methodId));
}

export const SHIPPING_AUTOSAVE_DELAY = 1700;

const PAYMENT_METHOD_VALID = ['amazonpay'];

const SingleShippingForm: React.FC<
    SingleShippingFormProps & WithLanguageProps & FormikProps<SingleShippingFormValues>
> = ({
    cartHasChanged,
    customerMessage,
    getFields,
    hasAddressLabel,
    isBillingSameAsShipping,
    isInitialValueLoaded,
    isValid,
    methodId,
    onSignIn = noop,
    onUnhandledError = noop,
    setFieldValue,
    setValues,
    shippingAddress,
    shippingAutosaveDelay = SHIPPING_AUTOSAVE_DELAY,
    shippingFormRenderTimestamp,
    values,
}) => {
    const {
        shipping: { hideBillingSameAsShippingCheck },
    } = useCapabilities();
    const {
        selectedState: { customer, config },
    } = useCheckout(({ data }) => ({ customer: data.getCustomer(), config: data.getConfig() }));
    const { themeV2 } = useThemeContext();
    const {
        consignments,
        deinitializeShippingMethod: deinitialize,
        deleteConsignments,
        initializeShippingMethod: initialize,
        isLoading,
        isShippingStepPending,
        defaultShippingExpectationMessage,
        shouldShowOrderComments,
        updateShippingAddress: updateAddress,
    } = useShipping();

    const propsRef = useRef({ values, shippingAddress, isValid });
    const debouncedUpdateAddressRef = useRef<
        | DebouncedFunc<(address: Address, includeShippingOptions: boolean) => Promise<void>>
        | undefined
    >(undefined);

    propsRef.current = { values, shippingAddress, isValid };

    const [isResettingAddress, setIsResettingAddress] = useState(false);
    const [isUpdatingShippingData, setIsUpdatingShippingData] = useState(false);
    const [hasRequestedShippingOptions, setHasRequestedShippingOptions] = useState(false);

    const stateOrProvinceCodeFormField = useMemo(() => {
        return getFields(values.shippingAddress?.countryCode).find(
            ({ name }) => name === 'stateOrProvinceCode',
        );
    }, [getFields, values.shippingAddress?.countryCode]);

    useEffect(() => {
        debouncedUpdateAddressRef.current = debounce(
            async (address: Address, includeShippingOptions: boolean) => {
                try {
                    await updateAddress(address, {
                        params: {
                            include: {
                                'consignments.availableShippingOptions': includeShippingOptions,
                            },
                        },
                    });

                    if (includeShippingOptions) {
                        setHasRequestedShippingOptions(true);
                    }
                } catch (error) {
                    if (isErrorWithType(error) && error.type === 'empty_cart') {
                        return onUnhandledError(error);
                    }
                } finally {
                    setIsUpdatingShippingData(false);
                }
            },
            shippingAutosaveDelay,
        );

        return () => {
            debouncedUpdateAddressRef.current?.cancel();
        };
    }, []);

    useEffect(() => {
        // Workaround for a bug found during manual testing:
        // When the shipping step first loads, the `stateOrProvinceCode` field may not be there.
        // It later appears with an empty value if the selected country has states/provinces.
        // To address this, we manually set `stateOrProvinceCode` in Formik.
        if (
            stateOrProvinceCodeFormField &&
            shippingAddress?.stateOrProvinceCode &&
            !values.shippingAddress?.stateOrProvinceCode &&
            shippingAddress?.countryCode === values.shippingAddress?.countryCode
        ) {
            setFieldValue(
                'shippingAddress.stateOrProvinceCode',
                shippingAddress.stateOrProvinceCode,
            );
        }
    }, [
        stateOrProvinceCodeFormField,
        shippingAddress?.countryCode,
        shippingAddress?.stateOrProvinceCode,
        values.shippingAddress?.countryCode,
        values.shippingAddress?.stateOrProvinceCode,
    ]);

    useEffect(() => {
        if (shippingFormRenderTimestamp) {
            setValues({
                billingSameAsShipping: isBillingSameAsShipping,
                orderComment: customerMessage,
                shippingAddress: mapAddressToFormValues(
                    getFields(shippingAddress?.countryCode),
                    decodeAddressLabel(shippingAddress, hasAddressLabel),
                ),
            });
        }
    }, [shippingFormRenderTimestamp]);

    const shippingAddressWithEmail = shippingAddress as AddressWithEmail | undefined;

    useEffect(() => {
        if (
            customer?.isGuest &&
            shippingAddressWithEmail?.email &&
            values.email !== shippingAddressWithEmail.email
        ) {
            void setFieldValue('email', shippingAddressWithEmail.email);
        }
    }, [customer?.isGuest, shippingAddressWithEmail?.email, setFieldValue, values.email]);

    const updateAddressWithFormData = (includeShippingOptions: boolean) => {
        const { values: currentValues, shippingAddress: currentShippingAddress } = propsRef.current;
        const addressForm = currentValues.shippingAddress;
        const updatedShippingAddress = addressForm && mapAddressFromFormValues(addressForm);

        let newIncludeShippingOptions = includeShippingOptions;

        if (Array.isArray(currentShippingAddress?.customFields)) {
            newIncludeShippingOptions =
                !isEqual(
                    currentShippingAddress?.customFields,
                    updatedShippingAddress?.customFields,
                ) || includeShippingOptions;
        }

        if (
            !updatedShippingAddress ||
            isEqualAddress(updatedShippingAddress, currentShippingAddress)
        ) {
            return;
        }

        setIsUpdatingShippingData(true);
        debouncedUpdateAddressRef.current?.(updatedShippingAddress, newIncludeShippingOptions);
    };

    const handleFieldChange = async (name: string) => {
        if (name === 'countryCode') {
            setFieldValue('shippingAddress.stateOrProvince', '');
            setFieldValue('shippingAddress.stateOrProvinceCode', '');
        }

        // Enqueue the following code to run after Formik has run validation
        await new Promise((resolve) => setTimeout(resolve));

        if (!propsRef.current.isValid) {
            return;
        }

        const isShippingField = SHIPPING_ADDRESS_FIELDS.includes(name);

        updateAddressWithFormData(isShippingField || !hasRequestedShippingOptions);
    };

    const handleAddressSelect = async (address: Address) => {
        setIsResettingAddress(true);

        try {
            await updateAddress(address);

            setValues({
                ...propsRef.current.values,
                shippingAddress: mapAddressToFormValues(getFields(address.countryCode), address),
            });
        } catch (error) {
            onUnhandledError(error);
        } finally {
            setIsResettingAddress(false);
        }
    };

    const handleUseNewAddress = async () => {
        setIsResettingAddress(true);

        try {
            const address = await deleteConsignments();
            const decoded = decodeAddressLabel(address, hasAddressLabel);

            setValues({
                ...propsRef.current.values,
                shippingAddress: mapAddressToFormValues(getFields(decoded?.countryCode), decoded),
            });
        } catch (error) {
            onUnhandledError(error);
        } finally {
            setIsResettingAddress(false);
        }
    };

    const shouldDisableSubmit = () => {
        if (!isValid) {
            return false;
        }

        if (customer?.isGuest) {
            return isLoading || isUpdatingShippingData;
        }

        return (
            isLoading ||
            isUpdatingShippingData ||
            !hasSelectedShippingOptions(consignments) ||
            !isSelectedShippingOptionValid(consignments)
        );
    };

    const shouldShowBillingSameAsShipping =
        !hideBillingSameAsShippingCheck &&
        !themeV2 &&
        !PAYMENT_METHOD_VALID.some((method) => method === methodId);

    const loginLink = config?.links?.loginLink
        ? `${config.links.loginLink}${config.links.checkoutLink ? `?redirectTo=${encodeURIComponent(config.links.checkoutLink)}` : ''}`
        : undefined;

    return (
        <Form autoComplete="on">
            <Fieldset>
                {customer?.isGuest && (
                    <div className="checkout-step-info">
                        <TranslatedString id="customer.login_text" />{' '}
                        {loginLink ? (
                            <a data-test="shipping-sign-in-link" href={loginLink}>
                                <TranslatedString id="customer.sign_in_action" />
                            </a>
                        ) : (
                            <a data-test="shipping-sign-in-link" href="#" onClick={onSignIn}>
                                <TranslatedString id="customer.sign_in_action" />
                            </a>
                        )}
                    </div>
                )}
                <ShippingAddress
                    consignments={consignments}
                    deinitialize={deinitialize}
                    formFields={getFields(values.shippingAddress?.countryCode)}
                    hasRequestedShippingOptions={hasRequestedShippingOptions}
                    initialize={initialize}
                    isLoading={isResettingAddress}
                    isShippingStepPending={isShippingStepPending}
                    methodId={methodId}
                    onAddressSelect={handleAddressSelect}
                    onFieldChange={handleFieldChange}
                    onUnhandledError={onUnhandledError}
                    onUseNewAddress={handleUseNewAddress}
                    shippingAddress={shippingAddress}
                />
                {shouldShowBillingSameAsShipping && (
                    <div className="form-body">
                        <CheckboxFormField
                            id="isGift"
                            labelContent={<TranslatedString id="shipping.is_gift_label" />}
                            name="isGift"
                            testId="isGift"
                        />
                        <BillingSameAsShippingField />
                    </div>
                )}
            </Fieldset>

            <ShippingFormFooter
                cartHasChanged={cartHasChanged}
                defaultShippingExpectationMessage={defaultShippingExpectationMessage}
                isInitialValueLoaded={isInitialValueLoaded}
                isLoading={isLoading || isUpdatingShippingData}
                isMultiShippingMode={false}
                shippingFormRenderTimestamp={shippingFormRenderTimestamp}
                shouldDisableSubmit={shouldDisableSubmit()}
                shouldShowOrderComments={shouldShowOrderComments}
                shouldShowShippingOptions={isValid}
            />
        </Form>
    );
};

export default withLanguage(
    withFormikExtended<SingleShippingFormProps & WithLanguageProps, SingleShippingFormValues>({
        handleSubmit: (values, { props: { onSubmit } }) => {
            onSubmit(values);
        },
        mapPropsToValues: ({
            getFields,
            shippingAddress,
            hasAddressLabel,
            isBillingSameAsShipping,
            customerMessage,
        }) => ({
            isGift: false,
            billingSameAsShipping: isBillingSameAsShipping,
            email: (shippingAddress as AddressWithEmail | undefined)?.email || '',
            orderComment: customerMessage,
            shippingAddress: mapAddressToFormValues(
                getFields(shippingAddress?.countryCode),
                decodeAddressLabel(shippingAddress, hasAddressLabel),
            ),
        }),
        validateOnMount: true,
        validationSchema: ({
            language,
            getFields,
            methodId,
        }: SingleShippingFormProps & WithLanguageProps) =>
            shouldHaveCustomValidation(methodId)
                ? object({
                      email: string().email('Email is invalid').notRequired(),
                      shippingAddress: lazy<Partial<AddressFormValues>>((formValues) => {
                          const fields = getFields(formValues && formValues.countryCode);
                          const translate = getTranslateAddressError(fields, language);

                          return getCustomFormFieldsValidationSchema({
                              translate,
                              formFields: fields,
                          }).concat(
                              getAddressExtraFieldsValidationSchema({
                                  translate,
                                  formFields: fields,
                              }),
                          );
                      }),
                  })
                : object({
                      email: string().email('Email is invalid').notRequired(),
                      shippingAddress: lazy<Partial<AddressFormValues>>((formValues) =>
                          getAddressFormFieldsValidationSchema({
                              language,
                              formFields: getFields(formValues?.countryCode),
                              validateMaxLength: true,
                          }),
                      ),
                  }),
        enableReinitialize: false, // This is false due to the concern that a shopper may lose typed details if somehow checkout state changes in the middle.
    })(SingleShippingForm),
);

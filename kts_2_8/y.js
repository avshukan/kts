(ctx) => {
    try {
        const {
            NEED_STAGES,
            FLORA_STAGES,
            STOP_REASONS,
            CALCULATION_STATUSES,
            LE_TYPES,
            LE_STAGES,
            CALCULATION_PROPOSES,
            GOOD_TYPES
        } = ctx.CONSTS;

        // Собираем data need и вычисляем stage

        const { opsNeed = {}, clientResponse, fillingFormAnketa } = ctx;

        delete opsNeed.additional_needs;

        const data = {
            ...opsNeed,
            tasks: [],
            filling_form_anketa: null,
            form_send: [],
            orders_fi_application_created: [],
            orders_fi_application_files_attached: [],
            orders_fi_application_filled: [],
            orders_fi_application_confirmation_requested: [],
            orders_fi_application_confirmation_received: [],
            orders_fi_application_offers_received: [],
            orders_fi_offer_confirmation_started: [],
            manual_confirmation: [],
            orders_fi_offer_completed: [],
            orders_fi_offer_annulment: [],
            orders_fi_application_cancelled: [],
            orders_fi_application_used_for_offer: [],
            orders_fi_application_used_for_manual_confirmation: [],
            orders_fi_offer_cancelled: []
        };

        // Вычисляем статус и заполняем соответствующие массивы

        // Потребность создана (created)
        let stage = NEED_STAGES.created;

        const clientHasSOPD = ['yellow', 'green'].includes(
            clientResponse?.body?.status?.stoplight_color
        );

        // Клиент подтвержден (client_confirmed)
        if (stage.code === NEED_STAGES.created.code) {
            if (clientHasSOPD) {
                stage = NEED_STAGES.client_confirmed;
            }
        }

        // Заполнение анкеты (filling_form_anketa)
        if (
            stage.code === NEED_STAGES.client_confirmed.code &&
            fillingFormAnketa !== null
        ) {
            stage = NEED_STAGES.filling_form_anketa;
            data.filling_form_anketa = fillingFormAnketa;
        }

        // Интеграционные статусы потребности
        if (
            (stage.code === NEED_STAGES.client_confirmed.code ||
                stage.code === NEED_STAGES.filling_form_anketa) &&
            data.orders.filter(
                (order) =>
                    order.orders_fi?.calculation_purpose?.uuid ===
                    CALCULATION_PROPOSES.ZAYAVKA_BANK &&
                    order.needs_and_orders_good_type?.uuid ===
                    GOOD_TYPES.ZAYAVKA_AUTOCREDIT
            ).length > 0
        ) {
            // вводим искусственные дополнительные константы
            // коллекция статусов FLORA с искусственным рангом (для индексов статуса)
            const floraStagesMap = new Map([
                ['application_creating', 0],
                ['application_files_attaching', 1],
                ['application_filling', 2],
                ['application_confirmation_requesting', 3],
                ['application_confirmation_receiving', 4],
                ['application_offers_receiving', 5]
            ]);
            // коллекция кода ответа FLORA с искусственным рангом (для индекса статусов)
            const floraCalculationStatusesMap = new Map([
                ['ERROR', 0],
                ['OK', 1]
            ]);
            // вспомогательная функция определения индекса в массиве интеграционных статусов
            const getIntegrationStageIndex = (floraResultJson) => {
                const stageCode = floraResultJson?.stage?.code;
                const statusCode = floraResultJson?.calculation_status?.code;
                const index =
                    (floraStagesMap.get(stageCode) ?? 0) +
                    (floraCalculationStatusesMap.get(statusCode) ?? 0);
                return index;
            };

            // перечисляем интеграционнные статусы потребностей
            const needIntegrationStages = [
                'form_send',
                'orders_fi_application_created',
                'orders_fi_application_files_attached',
                'orders_fi_application_filled',
                'orders_fi_application_confirmation_requested',
                'orders_fi_application_confirmation_received',
                'orders_fi_application_offers_received'
            ];
            let maxIntegrationStageIndex = 0; // stage "form_send" by default
            data.orders
                .filter(
                    (order) =>
                        order.orders_fi?.calculation_purpose?.uuid ===
                        CALCULATION_PROPOSES.ZAYAVKA_BANK &&
                        order.needs_and_orders_good_type.uuid ===
                        GOOD_TYPES.ZAYAVKA_AUTOCREDIT
                )
                .forEach((order) => {
                    const orderStageIndex = getIntegrationStageIndex(
                        order.orders_fi.flora_result_json
                    );
                    // пересчитываем статус потребности
                    maxIntegrationStageIndex = Math.max(
                        maxIntegrationStageIndex,
                        orderStageIndex
                    );
                    // заполняем массивы
                    needIntegrationStages
                        .filter((_stage, stageIndex) => stageIndex <= orderStageIndex)
                        .forEach((stage) => {
                            data[stage] = [order.uuid, ...(data[stage] ?? [])];
                        });
                });
            stage = NEED_STAGES[needIntegrationStages[maxIntegrationStageIndex]];
        }

        // Конкретное предложение выбрано для дальнейшего оформления (orders_fi_offer_confirmation_started)
        // Внимание!
        // В рамках FY23 переход к данному статусу не реализовывается
        // Продолжить оформление возможно только перейдя на статус manual_confirmation

        // Ручное внесение данных по сделке (manual_confirmation)
        const manualConfirmationOrders = data.orders.filter(
            (order) =>
                order.sale_is_stopped === false &&
                order.orders_fi?.calculation_purpose?.uuid ===
                CALCULATION_PROPOSES.BANK_PRODUCT &&
                order.needs_and_orders_good_type?.uuid === GOOD_TYPES.AUTOCREDIT &&
                order.orders_fi?.flora_result_json?.stage?.code ===
                FLORA_STAGES.manual_confirmation &&
                order.orders_fi?.flora_result_json?.calculation_status?.code ===
                CALCULATION_STATUSES.ok
        );

        if (clientHasSOPD && manualConfirmationOrders.length > 0) {
            stage = NEED_STAGES.manual_confirmation;
            data.manual_confirmation = manualConfirmationOrders.map(
                ({ uuid }) => uuid
            );
        }

        // Потребность исполнена (completed)
        const completedOrders = data.orders.filter((order) => {
            const approvedEvents = (data.legal_events ?? []).filter((le) => {
                return (
                    (le.needs_and_orders ?? []).some(({ uuid }) => uuid === order.uuid) &&
                    le.legal_event_type.uuid === LE_TYPES.APPROVED &&
                    le.legal_event_type.legal_execution_stage === LE_STAGES.DONE &&
                    le.clearance_is_complete === true &&
                    le.all_legal_conditions_for_needs_execution_met === true
                );
            });

            return (
                order.orders_fi?.calculation_purpose?.uuid ===
                CALCULATION_PROPOSES.BANK &&
                order.needs_and_orders_good_type.uuid === GOOD_TYPES.AUTOCREDIT &&
                approvedEvents.length > 0 &&
                order.sale_is_stopped === false &&
                order.legal_execution_stage?.uuid === LE_STAGES.DONE
            );
        });

        if (completedOrders.length) {
            if (data.legal_execution_stage?.uuid === LE_STAGES.DONE) {
                stage = NEED_STAGES.completed;
            }
            data.orders_fi_offer_completed = completedOrders.map(({ uuid }) => uuid);
        }

        // Аут (cancelled)
        // Данный статус необходимо вычислять отдельно, последним!
        // _message заполняется в следующем fx-блоке

        // заполняем статус
        data.need_fi_stage = stage;

        // Заполняем остальные массивы, не связанные со статусом
        (data.orders ?? []).forEach((order) => {
            // orders_fi_offer_annulment
            // В рамках FY23 переход к данному статусу не реализовывается. Процесс аннулирования оформленного кредитного предложения не проанализирован командой F&I.

            // orders_fi_application_cancelled
            if (
                order.orders_fi?.calculation_purpose?.uuid ===
                CALCULATION_PROPOSES.ZAYAVKA_BANK &&
                order.needs_and_orders_good_type === GOOD_TYPES.ZAYAVKA_AUTOCREDIT &&
                order.sale_is_stopped === true &&
                order.sale_stop_reason === STOP_REASONS.unchecked &&
                order.orders_fi.legal_execution_stage.uuid !== LE_STAGES.DONE
            ) {
                data.orders_fi_offer_cancelled.push(order.uuid);
            }

            // orders_fi_application_used_for_offer
            if (
                order.orders_fi?.calculation_purpose?.uuid ===
                CALCULATION_PROPOSES.ZAYAVKA_BANK &&
                order.needs_and_orders_good_type === GOOD_TYPES.ZAYAVKA_AUTOCREDIT &&
                order.sale_is_stopped === true &&
                order.sale_stop_reason === STOP_REASONS.checked &&
                order.orders_fi.legal_execution_stage.uuid !== LE_STAGES.DONE
            ) {
                data.orders_fi_application_used_for_offer.push(order.uuid);
            }

            // orders_fi_application_used_for_manual_confirmation
            if (
                order.orders_fi?.calculation_purpose?.uuid ===
                CALCULATION_PROPOSES.ZAYAVKA_BANK &&
                order.needs_and_orders_good_type === GOOD_TYPES.ZAYAVKA_AUTOCREDIT &&
                order.sale_is_stopped === true &&
                order.sale_stop_reason === STOP_REASONS.non_flora &&
                order.orders_fi.legal_execution_stage.uuid !== LE_STAGES.DONE
            ) {
                data.orders_fi_application_used_for_manual_confirmation.push(
                    order.uuid
                );
            }

            // orders_fi_offer_cancelled
            if (
                order.orders_fi?.calculation_purpose?.uuid ===
                CALCULATION_PROPOSES.BANK_PRODUCT &&
                order.needs_and_orders_good_type === GOOD_TYPES.AUTOCREDIT &&
                order.sale_is_stopped === true &&
                order.orders_fi.legal_execution_stage.uuid !== LE_STAGES.DONE
            ) {
                data.orders_fi_offer_cancelled.push(order.uuid);
            }
        });

        ctx.error = false;
        return data;
    } catch (error) {
        ctx.error = error;
        return {};
    }
}

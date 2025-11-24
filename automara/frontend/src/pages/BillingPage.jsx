import React, { useState } from 'react';
import { useBilling, plans, ADDITIONAL_AUTOMATION_PRICE } from '../context/BillingContext';
import StripePaymentModal from '../components/StripePaymentModal';

function BillingPage() {
  const { currentPlan, purchasedAutomations, upgradePlan, getTotalAllowedAutomations } = useBilling();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSelectPlan = (planId) => {
    if (planId === currentPlan) return;
    setSelectedPlan(plans[planId]);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    if (selectedPlan) {
      upgradePlan(selectedPlan.id);
      setSuccessMessage(`Successfully subscribed to ${selectedPlan.name}!`);
      setTimeout(() => setSuccessMessage(''), 5000);
    }
    setShowPaymentModal(false);
    setSelectedPlan(null);
  };

  const getPlanIcon = (planId) => {
    switch (planId) {
      case 'starter':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'sme':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        );
      case 'msp':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-theme-accent via-theme-accent-alt to-theme-accent bg-clip-text text-transparent mb-3">
            Billing & Plans
          </h1>
          <p className="text-slate-400 text-lg">Choose the perfect plan for your automation needs</p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-8 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-6 py-4 rounded-xl flex items-center gap-3 max-w-2xl mx-auto">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Current Plan Summary */}
        <div className="mb-12 glass-card rounded-2xl p-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">Current Plan</p>
              <h3 className="text-2xl font-bold text-white">{plans[currentPlan]?.name}</h3>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-sm mb-1">Total Automations</p>
              <p className="text-2xl font-bold text-theme-accent">
                {getTotalAllowedAutomations()}
                {purchasedAutomations.length > 0 && (
                  <span className="text-sm text-slate-400 ml-1">
                    (+{purchasedAutomations.length} purchased)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {Object.entries(plans).map(([planId, plan]) => {
            const isCurrentPlan = planId === currentPlan;
            const isPopular = planId === 'sme';

            return (
              <div
                key={planId}
                className={`relative glass-card rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                  isCurrentPlan
                    ? 'border-2 border-theme-primary shadow-lg shadow-theme-primary/20'
                    : 'hover:border-theme-primary/50 hover:shadow-theme-primary/10'
                }`}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-gradient-to-r from-theme-primary to-theme-secondary text-white text-xs font-bold px-4 py-1 rounded-bl-xl">
                      POPULAR
                    </div>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute top-4 left-4">
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold px-3 py-1 rounded-full">
                      CURRENT PLAN
                    </span>
                  </div>
                )}

                <div className="p-8">
                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
                    isCurrentPlan
                      ? 'bg-gradient-to-br from-theme-primary to-theme-secondary text-white shadow-lg shadow-theme-primary/40'
                      : 'bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 text-theme-accent border border-theme-primary/20'
                  }`}>
                    {getPlanIcon(planId)}
                  </div>

                  {/* Plan Name & Description */}
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-slate-400 text-sm mb-6">{plan.description}</p>

                  {/* Price */}
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-white">${plan.price}</span>
                    <span className="text-slate-400">/month</span>
                  </div>

                  {/* Automation Limit */}
                  <div className="bg-slate-900/50 rounded-xl p-4 mb-6 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Automations</span>
                      <span className="text-xl font-bold text-theme-accent">{plan.automationLimit}</span>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3 text-sm">
                        <div className="w-5 h-5 bg-theme-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-theme-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-slate-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleSelectPlan(planId)}
                    disabled={isCurrentPlan}
                    className={`w-full py-3.5 px-6 rounded-xl font-semibold transition-all ${
                      isCurrentPlan
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark hover:from-theme-primary hover:to-theme-secondary text-white shadow-lg shadow-theme-primary/30 hover:shadow-theme-primary/50 btn-premium'
                    }`}
                  >
                    {isCurrentPlan ? 'Current Plan' : 'Subscribe Now'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Automations Info */}
        <div className="glass-card rounded-2xl p-8 max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-theme-primary/20">
            <svg className="w-7 h-7 text-theme-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Need More Automations?</h3>
          <p className="text-slate-400 mb-4">
            Purchase additional automations at <span className="text-theme-accent font-bold">${ADDITIONAL_AUTOMATION_PRICE}/month</span> each
          </p>
          <p className="text-sm text-slate-500">
            Additional automations can be purchased directly from the Automation Library when activating workflows beyond your plan limit.
          </p>
        </div>

        {/* Purchased Automations */}
        {purchasedAutomations.length > 0 && (
          <div className="mt-8 glass-card rounded-2xl p-6 max-w-2xl mx-auto">
            <h3 className="text-lg font-bold text-white mb-4">Purchased Automations</h3>
            <div className="space-y-2">
              {purchasedAutomations.map((id, index) => (
                <div key={id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Automation #{index + 1}</span>
                  <span className="text-theme-accent font-medium">${ADDITIONAL_AUTOMATION_PRICE}/mo</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Total additional cost</span>
              <span className="text-xl font-bold text-white">${purchasedAutomations.length * ADDITIONAL_AUTOMATION_PRICE}/mo</span>
            </div>
          </div>
        )}
      </div>

      {/* Stripe Payment Modal */}
      <StripePaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedPlan(null);
        }}
        onSuccess={handlePaymentSuccess}
        paymentType="plan"
        planDetails={selectedPlan}
      />
    </div>
  );
}

export default BillingPage;

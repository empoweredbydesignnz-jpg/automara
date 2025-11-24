import React, { createContext, useContext, useState, useEffect } from 'react';

const BillingContext = createContext();

export const plans = {
  starter: {
    id: 'starter',
    name: 'Automara Starter',
    price: 29,
    automationLimit: 1,
    description: 'Perfect for individuals getting started',
    features: [
      '1 automation included',
      'Basic support',
      'Standard integrations',
      'Email notifications'
    ]
  },
  sme: {
    id: 'sme',
    name: 'Automara SME',
    price: 99,
    automationLimit: 5,
    description: 'Ideal for small to medium businesses',
    features: [
      '5 automations included',
      'Priority support',
      'Advanced integrations',
      'Email & SMS notifications',
      'Analytics dashboard'
    ]
  },
  msp: {
    id: 'msp',
    name: 'Automara MSP',
    price: 299,
    automationLimit: 50,
    description: 'For managed service providers',
    features: [
      '50 automations included',
      'Dedicated support',
      'All integrations',
      'White-label options',
      'Multi-tenant management',
      'Custom workflows'
    ]
  }
};

export const ADDITIONAL_AUTOMATION_PRICE = 10;

export function BillingProvider({ children }) {
  const [currentPlan, setCurrentPlan] = useState(() => {
    const saved = localStorage.getItem('billing-plan');
    return saved || 'starter';
  });

  const [purchasedAutomations, setPurchasedAutomations] = useState(() => {
    const saved = localStorage.getItem('purchased-automations');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeWorkflowCount, setActiveWorkflowCount] = useState(0);

  useEffect(() => {
    localStorage.setItem('billing-plan', currentPlan);
  }, [currentPlan]);

  useEffect(() => {
    localStorage.setItem('purchased-automations', JSON.stringify(purchasedAutomations));
  }, [purchasedAutomations]);

  const getPlanLimit = () => {
    return plans[currentPlan]?.automationLimit || 1;
  };

  const getTotalAllowedAutomations = () => {
    return getPlanLimit() + purchasedAutomations.length;
  };

  const canActivateAutomation = (workflowId) => {
    const limit = getTotalAllowedAutomations();
    if (activeWorkflowCount < limit) return true;
    return purchasedAutomations.includes(workflowId);
  };

  const needsPurchase = (workflowId) => {
    const limit = getTotalAllowedAutomations();
    if (activeWorkflowCount < limit) return false;
    return !purchasedAutomations.includes(workflowId);
  };

  const purchaseAutomation = (workflowId) => {
    if (!purchasedAutomations.includes(workflowId)) {
      setPurchasedAutomations([...purchasedAutomations, workflowId]);
    }
  };

  const upgradePlan = (planId) => {
    if (plans[planId]) {
      setCurrentPlan(planId);
    }
  };

  return (
    <BillingContext.Provider value={{
      currentPlan,
      plans,
      purchasedAutomations,
      activeWorkflowCount,
      setActiveWorkflowCount,
      getPlanLimit,
      getTotalAllowedAutomations,
      canActivateAutomation,
      needsPurchase,
      purchaseAutomation,
      upgradePlan,
      ADDITIONAL_AUTOMATION_PRICE
    }}>
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling() {
  const context = useContext(BillingContext);
  if (!context) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return context;
}

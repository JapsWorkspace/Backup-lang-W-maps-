import React, { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

/* ================= SCREENS ================= */
import GetStarted from "./screens/GetStarted";
import LogIn from "./screens/LogIn";
import PrivacyGate from "./screens/PrivacyGate";
import SignUp from "./screens/SignUp";
import SendOtp from "./screens/SendOtp";
import VerifyOtp from "./screens/VerifyOtp";

import PasswordSecurity from "./screens/PasswordSecurity";
import PersonalDetails from "./screens/PersonalDetails";

import AppShell from "./screens/AppShell";
import MainCenter from "./screens/MainCenter";
import Map from "./screens/Map";
import IncidentReportScreen from "./screens/IncidentReportingScreen";
import Profile from "./screens/Profile";
import RiskHeatMap from "./screens/RiskHeatMap";
import Guidelines from "./screens/Guidelines";
import SafetyMark from "./screens/SafetyMark";

/* ================= PROVIDERS ================= */
import { UserProvider } from "./screens/UserProvider";
import { UserContext } from "./screens/UserContext";
import SearchProvider from "./screens/SearchContext"; // ✅ DEFAULT IMPORT

const Stack = createNativeStackNavigator();

/* ================= AUTH STACK ================= */
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GetStarted" component={GetStarted} />
      <Stack.Screen name="LogIn" component={LogIn} />
      <Stack.Screen name="PrivacyGate" component={PrivacyGate} />
      <Stack.Screen name="SignUp" component={SignUp} />
      <Stack.Screen name="SendOtp" component={SendOtp} />
      <Stack.Screen
        name="VerifyOtp"
        component={VerifyOtp}
        options={{ presentation: "modal" }}
      />
    </Stack.Navigator>
  );
}

/* ================= APP STACK ================= */
function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AppShell" component={AppShell} />
    </Stack.Navigator>
  );
}

/* ================= ROOT SWITCH ================= */
function RootNavigator() {
  const { user, loading } = useContext(UserContext);
  if (loading) return null;
  return user ? <AppStack /> : <AuthStack />;
}

/* ================= APP ROOT ================= */
export default function App() {
  return (
    <UserProvider>
      <SearchProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SearchProvider>
    </UserProvider>
  );
}

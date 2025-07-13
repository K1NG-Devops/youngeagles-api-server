import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Card,
  Title,
  HelperText,
  ActivityIndicator,
} from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigation } from '@react-navigation/native';
import { useLogin } from '../hooks/useAuth';

// Validation schema
const schema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

type FormData = {
  email: string;
  password: string;
};

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await loginMutation.mutateAsync(data);
      // Navigation will be handled by the auth state change
    } catch (error: any) {
      Alert.alert(
        'Login Failed',
        error.response?.data?.message || 'Please check your credentials and try again.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Title style={styles.title}>Young Eagles</Title>
          <Text style={styles.subtitle}>Welcome back!</Text>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <>
                  <TextInput
                    label="Email"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={!!errors.email}
                    style={styles.input}
                  />
                  {errors.email && (
                    <HelperText type="error" visible={!!errors.email}>
                      {errors.email.message}
                    </HelperText>
                  )}
                </>
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <>
                  <TextInput
                    label="Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    mode="outlined"
                    secureTextEntry={!showPassword}
                    error={!!errors.password}
                    style={styles.input}
                    right={
                      <TextInput.Icon
                        icon={showPassword ? 'eye-off' : 'eye'}
                        onPress={() => setShowPassword(!showPassword)}
                      />
                    }
                  />
                  {errors.password && (
                    <HelperText type="error" visible={!!errors.password}>
                      {errors.password.message}
                    </HelperText>
                  )}
                </>
              )}
            />

            <Button
              mode="contained"
              onPress={handleSubmit(onSubmit)}
              loading={loginMutation.isLoading}
              disabled={loginMutation.isLoading}
              style={styles.button}
            >
              {loginMutation.isLoading ? 'Logging in...' : 'Login'}
            </Button>

            <Button
              mode="text"
              onPress={() => navigation.navigate('ForgotPassword' as never)}
              style={styles.forgotButton}
            >
              Forgot Password?
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.footer}>
          <Text>Don't have an account? </Text>
          <Button
            mode="text"
            onPress={() => navigation.navigate('Register' as never)}
            compact
          >
            Sign Up
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginTop: 8,
  },
  card: {
    elevation: 4,
  },
  input: {
    marginBottom: 8,
  },
  button: {
    marginTop: 16,
    paddingVertical: 8,
  },
  forgotButton: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
});

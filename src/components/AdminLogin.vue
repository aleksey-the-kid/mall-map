<script setup>
import { ref } from 'vue'

const props = defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  signIn: { type: Function, required: true },
})

const email = ref('test@test.test')
const password = ref('testtest')
const localError = ref('')

async function onSubmit() {
  localError.value = ''
  if (!email.value || !password.value) {
    localError.value = 'Введите email и пароль'
    return
  }
  try {
    await props.signIn({ email: email.value, password: password.value })
  } catch (err) {
    localError.value = err.message
  }
}
</script>

<template>
  <div class="login">
    <div class="login__card">
      <h1>Админка</h1>
      <p class="login__hint">Войдите для управления торговыми центрами</p>

      <form class="login__form" @submit.prevent="onSubmit">
        <label class="login__field">
          <span>Email</span>
          <input v-model="email" type="email" autocomplete="username" required />
        </label>
        <label class="login__field">
          <span>Пароль</span>
          <input v-model="password" type="password" autocomplete="current-password" required />
        </label>

        <p v-if="localError || error" class="login__error">{{ localError || error }}</p>

        <button type="submit" class="login__btn" :disabled="loading">
          {{ loading ? 'Вход…' : 'Войти' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  padding: 24px;
}

.login__card {
  width: 100%;
  max-width: 380px;
  background: #fff;
  border-radius: 12px;
  padding: 28px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.login__card h1 {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 8px;
}

.login__hint {
  font-size: 14px;
  color: #666;
  margin-bottom: 24px;
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #555;
}

.login__field input {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.login__error {
  font-size: 13px;
  color: #c0392b;
}

.login__btn {
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  background: #1a1a1a;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}

.login__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

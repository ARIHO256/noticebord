import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';
import ModernCard from '../components/ModernCard';

const MEALS = ['Breakfast', 'Lunch', 'Dinner'];

const MENU = {
  Breakfast: [
    { name: 'Katogo (Matoke & Beef)', price: '6,000 UGX', calories: '450 kcal', icon: 'food-variant' },
    { name: 'Chapati & Beans', price: '3,500 UGX', calories: '380 kcal', icon: 'bread-slice' },
    { name: 'Mandazi & Tea', price: '2,000 UGX', calories: '290 kcal', icon: 'coffee' },
    { name: 'Rolex (Egg Roll)', price: '3,000 UGX', calories: '420 kcal', icon: 'egg-fried' },
    { name: 'Porridge & Bread', price: '2,500 UGX', calories: '310 kcal', icon: 'bowl-mix' },
  ],
  Lunch: [
    { name: 'Rice & Chicken Stew', price: '8,000 UGX', calories: '620 kcal', icon: 'rice' },
    { name: 'Posho & Beans', price: '4,500 UGX', calories: '510 kcal', icon: 'barley' },
    { name: 'Matoke & Groundnut Sauce', price: '5,500 UGX', calories: '580 kcal', icon: 'food-apple' },
    { name: 'Spaghetti & Meatballs', price: '7,500 UGX', calories: '650 kcal', icon: 'noodles' },
    { name: 'Irish & Fish Fillet', price: '9,000 UGX', calories: '540 kcal', icon: 'fish' },
  ],
  Dinner: [
    { name: 'Pilau & Beef', price: '8,500 UGX', calories: '680 kcal', icon: 'food-turkey' },
    { name: 'Sweet Potatoes & Beans', price: '4,000 UGX', calories: '470 kcal', icon: 'sweet-potato' },
    { name: 'Cassava & Peanut Sauce', price: '4,500 UGX', calories: '520 kcal', icon: 'peanut' },
    { name: 'Vegetable Stir-fry & Rice', price: '6,000 UGX', calories: '450 kcal', icon: 'carrot' },
    { name: 'Ugali & Sukuma Wiki', price: '3,500 UGX', calories: '380 kcal', icon: 'leaf' },
  ],
};

export default function CafeteriaMenuScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [selectedMeal, setSelectedMeal] = useState('Breakfast');
  const items = MENU[selectedMeal as keyof typeof MENU] || [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader title="Cafeteria Menu" onBack={() => navigation.goBack()} gradient={['#E91E63', '#FF5722']} />

      {/* Meal Selector */}
      <View style={styles.mealRow}>
        {MEALS.map((meal) => (
          <TouchableOpacity
            key={meal}
            onPress={() => setSelectedMeal(meal)}
            style={[styles.mealChip, selectedMeal === meal && { backgroundColor: '#E91E63' }]}
          >
            <Text style={[styles.mealText, { color: selectedMeal === meal ? '#fff' : theme.colors.text }]}>{meal}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {selectedMeal} Options
        </Text>

        {items.map((item, index) => (
          <ModernCard key={index} style={{ marginBottom: 12 }}>
            <View style={styles.itemRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#E91E6312' }]}>
                <MaterialCommunityIcons name={item.icon as any} size={24} color="#E91E63" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.itemName, { color: theme.colors.text }]}>{item.name}</Text>
                <Text style={[styles.itemMeta, { color: theme.colors.muted }]}>{item.calories}</Text>
              </View>
              <View style={styles.priceBadge}>
                <Text style={styles.priceText}>{item.price}</Text>
              </View>
            </View>
          </ModernCard>
        ))}

        <ModernCard style={{ marginTop: 8, borderColor: '#FF572220', borderWidth: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <MaterialCommunityIcons name="clock-outline" size={22} color="#FF5722" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Serving Hours</Text>
              <Text style={[styles.infoBody, { color: theme.colors.muted }]}>
                Breakfast: 7:00 AM – 9:30 AM{'\n'}
                Lunch: 12:00 PM – 2:30 PM{'\n'}
                Dinner: 5:30 PM – 8:00 PM
              </Text>
            </View>
          </View>
        </ModernCard>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mealRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  mealChip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.04)' },
  mealText: { fontWeight: '800', fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginBottom: 14, paddingHorizontal: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 15, fontWeight: '700' },
  itemMeta: { fontSize: 12, marginTop: 2 },
  priceBadge: { backgroundColor: '#E91E6318', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  priceText: { color: '#E91E63', fontWeight: '800', fontSize: 13 },
  infoTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  infoBody: { fontSize: 13, lineHeight: 20 },
});
